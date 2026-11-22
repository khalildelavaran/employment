import React, { useState, useMemo, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Terminal,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowUpLeft,
  Coins,
} from 'lucide-react';
import {
  CustomSmsTemplateRecord,
  FarazProviderStatus,
  SmsEventKey,
  SmsSendMode,
  SmsSettingsConfig,
} from '../types/recruitment.ts';
import { toPersianDigits } from '../utils/validation.ts';

type TestSourceKind = 'system' | 'custom' | 'free';

interface VariableDefinition {
  token: string;
  label: string;
  sample: string;
}

const KNOWN_VARIABLES: Record<string, VariableDefinition> = {
  code: { token: 'code', label: 'کد تایید ۶ رقمی', sample: '۴۸۲۹۱۵' },
  name: { token: 'name', label: 'نام و نام خانوادگی متقاضی', sample: 'نگار موسوی' },
  national_code: { token: 'national_code', label: 'کد ملی متقاضی', sample: '1880452194' },
  mobile: { token: 'mobile', label: 'شماره موبایل', sample: '09164112288' },
  status: { token: 'status', label: 'وضعیت جدید پرونده', sample: 'دعوت به مصاحبه' },
  interview_date: { token: 'interview_date', label: 'تاریخ مصاحبه', sample: '۱۴۰۵/۰۹/۰۵' },
  interview_time: { token: 'interview_time', label: 'ساعت مصاحبه', sample: '۱۰:۳۰' },
  location: { token: 'location', label: 'مکان مصاحبه', sample: 'دفتر مرکزی شرکت دستوا' },
  interview_details: {
    token: 'interview_details',
    label: 'جزئیات کامل مصاحبه',
    sample: '\nزمان مصاحبه: ۱۴۰۵/۰۹/۰۵ ساعت ۱۰:۳۰\nمکان: دفتر مرکزی شرکت دستوا',
  },
  job_title: { token: 'job_title', label: 'عنوان شغلی', sample: 'کارمند اداری و دفتری' },
  date: { token: 'date', label: 'تاریخ و ساعت ثبت', sample: '۱۴۰۵/۰۸/۲۵ - ۱۰:۳۰' },
};

const SYSTEM_EVENT_OPTIONS: Array<{ key: SmsEventKey; title: string }> = [
  { key: 'OTP', title: 'کد تایید دومرحله‌ای (OTP)' },
  { key: 'REGISTRATION_SUCCESS', title: 'تایید ثبت‌نام موفق متقاضی' },
  { key: 'STATUS_AND_INTERVIEW', title: 'تغییر وضعیت و دعوت به مصاحبه' },
  { key: 'ADMIN_NEW_APPLICANT', title: 'اطلاع‌رسانی به مدیر هنگام ثبت‌نام جدید' },
];

function buildInitialSampleMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, def] of Object.entries(KNOWN_VARIABLES)) {
    out[k] = def.sample;
  }
  return out;
}

function estimatePersianSmsPages(text: string): number {
  const len = (text || '').length;
  if (len <= 70) return 1;
  return Math.ceil(len / 67);
}

function renderWithVariables(template: string, values: Record<string, string>): string {
  return template.replace(/%([a-zA-Z0-9_]+)%/g, (_m, key: string) =>
    values[key] !== undefined ? values[key] : `%${key}%`
  );
}

interface DispatchDiagnostic {
  kind: 'dispatch';
  success: boolean;
  timestamp: string;
  recipient: string;
  mode: SmsSendMode;
  line_number: string;
  pattern_code?: string;
  rendered_text?: string;
  sms_pages?: number;
  estimated_cost_toman?: number;
  duration_ms?: number;
  provider_ref?: string;
  provider_response?: string;
  error?: string;
  log_id?: number;
}

interface ConnectivityDiagnostic {
  kind: 'connectivity';
  connected: boolean;
  duration_ms: number;
  balance_toman: number | null;
  lines_count: number;
  patterns_count: number;
  error?: string;
}

interface SmsTestSandboxTabProps {
  settings: SmsSettingsConfig;
  provider: FarazProviderStatus | null;
  customTemplates: CustomSmsTemplateRecord[];
  effectiveUnitCostToman: number;
  onRefreshAfterSend: () => void;
  onNavigateLogs: () => void;
}

export const SmsTestSandboxTab: React.FC<SmsTestSandboxTabProps> = ({
  settings,
  provider,
  customTemplates,
  effectiveUnitCostToman,
  onRefreshAfterSend,
  onNavigateLogs,
}) => {
  const [sourceKind, setSourceKind] = useState<TestSourceKind>('system');
  const [selectedSystemKey, setSelectedSystemKey] = useState<SmsEventKey>('OTP');
  const [selectedCustomId, setSelectedCustomId] = useState<number>(customTemplates[0]?.id || 0);

  const [freeText, setFreeText] = useState(
    'سلام %name% عزیز، این پیامک جهت تست اتصال سامانه استخدام شرکت دستوا به فراز اس‌ام‌اس ارسال شده است.'
  );
  const [freePatternCode, setFreePatternCode] = useState('');

  const [recipientMobile, setRecipientMobile] = useState(settings.admin_mobile || '');
  const [modeOverride, setModeOverride] = useState<'auto' | SmsSendMode>('auto');
  const [lineOverride, setLineOverride] = useState<string>('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>(buildInitialSampleMap);

  const [sending, setSending] = useState(false);
  const [checkingConn, setCheckingConn] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DispatchDiagnostic | ConnectivityDiagnostic | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    if (customTemplates.length > 0 && !customTemplates.some((t) => t.id === selectedCustomId)) {
      setSelectedCustomId(customTemplates[0].id);
    }
  }, [customTemplates, selectedCustomId]);

  const activeCustomTemplate = useMemo(
    () => customTemplates.find((t) => t.id === selectedCustomId) || null,
    [customTemplates, selectedCustomId]
  );

  // Determine raw template text, pattern code, pattern var map, and default send mode
  const activeConfig = useMemo(() => {
    if (sourceKind === 'system') {
      const tpl = settings.templates[selectedSystemKey];
      const baseMode: SmsSendMode =
        tpl.send_mode_override !== 'default' ? tpl.send_mode_override : settings.send_mode;
      return {
        text: tpl.text_template,
        patternCode: tpl.pattern_code,
        varMap: tpl.pattern_var_map || {},
        baseMode,
      };
    }
    if (sourceKind === 'custom' && activeCustomTemplate) {
      return {
        text: activeCustomTemplate.text_template,
        patternCode: activeCustomTemplate.pattern_code,
        varMap: activeCustomTemplate.pattern_var_map || {},
        baseMode: activeCustomTemplate.send_mode,
      };
    }
    return {
      text: freeText,
      patternCode: freePatternCode,
      varMap: {} as Record<string, string>,
      baseMode: (freePatternCode.trim() ? 'pattern' : 'text') as SmsSendMode,
    };
  }, [sourceKind, selectedSystemKey, settings, activeCustomTemplate, freeText, freePatternCode]);

  // Extract all variable placeholders in the template text and pattern var map
  const detectedTokens = useMemo(() => {
    const tokens = new Set<string>();
    const matches = activeConfig.text.matchAll(/%([a-zA-Z0-9_]+)%/g);
    for (const m of matches) {
      if (m[1]) tokens.add(m[1]);
    }
    for (const sourceToken of Object.values(activeConfig.varMap)) {
      if (sourceToken) tokens.add(sourceToken);
    }
    if (sourceKind === 'free' && freePatternCode.trim()) {
      const farazPattern = provider?.patterns.find((p) => p.code === freePatternCode.trim());
      if (farazPattern?.vars) {
        farazPattern.vars.forEach((v) => tokens.add(v));
      }
    }
    return Array.from(tokens);
  }, [activeConfig, sourceKind, freePatternCode, provider]);

  const renderedPreview = useMemo(
    () => renderWithVariables(activeConfig.text, variableValues),
    [activeConfig.text, variableValues]
  );

  const previewPages = estimatePersianSmsPages(renderedPreview);
  const estimatedCost = previewPages * effectiveUnitCostToman;

  const desiredMode: SmsSendMode = modeOverride === 'auto' ? activeConfig.baseMode : modeOverride;
  const effectiveMode: SmsSendMode =
    desiredMode === 'pattern' && activeConfig.patternCode.trim().length > 0 ? 'pattern' : 'text';

  const handleCheckConnectivity = async () => {
    setCheckingConn(true);
    setShowRawJson(false);
    try {
      const res = await fetch('/api/admin/sms/provider-info');
      const data = await res.json();
      const prov = data.provider as FarazProviderStatus | undefined;
      setDiagnostic({
        kind: 'connectivity',
        connected: Boolean(prov?.connected),
        duration_ms: Number(data.duration_ms || 0),
        balance_toman: prov?.balance_toman ?? null,
        lines_count: prov?.lines?.length || 0,
        patterns_count: prov?.patterns?.length || 0,
        error: prov?.error,
      });
    } catch {
      setDiagnostic({
        kind: 'connectivity',
        connected: false,
        duration_ms: 0,
        balance_toman: null,
        lines_count: 0,
        patterns_count: 0,
        error: 'خطا در برقراری ارتباط با سرور برای بررسی وضعیت فراز اس‌ام‌اس.',
      });
    } finally {
      setCheckingConn(false);
    }
  };

  const handleSendLiveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setShowRawJson(false);

    try {
      let res: Response;
      if (sourceKind === 'custom' && activeCustomTemplate) {
        res = await fetch(`/api/admin/sms/templates/${activeCustomTemplate.id}/send-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: recipientMobile.trim(),
            variables: variableValues,
            mode: modeOverride === 'auto' ? undefined : modeOverride,
            line_number: lineOverride || undefined,
          }),
        });
      } else {
        const patternVarMap: Record<string, string> = {};
        if (sourceKind === 'free' && freePatternCode.trim()) {
          detectedTokens.forEach((t) => {
            patternVarMap[t] = t;
          });
        }
        res = await fetch('/api/admin/sms/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: recipientMobile.trim(),
            event_type: sourceKind === 'system' ? selectedSystemKey : 'TEST_SMS',
            custom_text: sourceKind === 'free' ? freeText : undefined,
            pattern_code: sourceKind === 'free' ? freePatternCode.trim() : undefined,
            pattern_var_map: sourceKind === 'free' && freePatternCode.trim() ? patternVarMap : undefined,
            mode: modeOverride === 'auto' ? undefined : modeOverride,
            line_number: lineOverride || undefined,
            variables: variableValues,
          }),
        });
      }

      const data = await res.json();
      const result = data.result || {};
      setDiagnostic({
        kind: 'dispatch',
        success: Boolean(res.ok && data.success),
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        recipient: recipientMobile.trim(),
        mode: (result.mode as SmsSendMode) || effectiveMode,
        line_number: result.line_number || lineOverride || settings.line_number || 'خودکار',
        pattern_code: result.pattern_code || '',
        rendered_text: result.rendered_text || renderedPreview,
        sms_pages: result.sms_pages ?? previewPages,
        estimated_cost_toman: result.estimated_cost_toman ?? (res.ok && data.success ? estimatedCost : 0),
        duration_ms: result.duration_ms,
        provider_ref: result.provider_ref || '',
        provider_response: result.provider_response || '',
        error: data.error || result.error,
        log_id: result.log_id,
      });
      onRefreshAfterSend();
    } catch {
      setDiagnostic({
        kind: 'dispatch',
        success: false,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        recipient: recipientMobile.trim(),
        mode: effectiveMode,
        line_number: lineOverride || settings.line_number || 'خودکار',
        error: 'خطا در ارتباط با سرور هنگام ارسال پیامک آزمایشی.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Right Column (7 cols): Test Configuration & Editable Sample Variables */}
      <form
        onSubmit={handleSendLiveTest}
        className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 text-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>آزمایشگاه تست ارسال پیامک و رندر قالب (SMS Test)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              پیش از فعال‌سازی عمومی، اتصال وب‌سرویس فراز اس‌ام‌اس، خط فرستنده و جایگذاری دقیق متغیرها را روی شماره دلخواه آزمایش کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckConnectivity}
            disabled={checkingConn}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Activity className={`w-3.5 h-3.5 ${checkingConn ? 'animate-pulse text-blue-600' : ''}`} />
            <span>{checkingConn ? 'در حال بررسی...' : 'تست سریع اتصال API'}</span>
          </button>
        </div>

        {/* Source Kind Segmented Control */}
        <div className="space-y-2">
          <label className="block font-bold text-slate-700 dark:text-slate-300">
            منبع پیامک آزمایشی
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSourceKind('system')}
              className={`py-2 px-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sourceKind === 'system'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              قالب‌های سیستمی (۴)
            </button>
            <button
              type="button"
              onClick={() => setSourceKind('custom')}
              className={`py-2 px-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sourceKind === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              قالب‌های سفارشی ({toPersianDigits(customTemplates.length)})
            </button>
            <button
              type="button"
              onClick={() => setSourceKind('free')}
              className={`py-2 px-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sourceKind === 'free'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              متن یا پترن آزاد
            </button>
          </div>
        </div>

        {/* Template Selector OR Free Text/Pattern Inputs */}
        {sourceKind === 'system' && (
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              انتخاب قالب خودکار سیستمی
            </label>
            <select
              value={selectedSystemKey}
              onChange={(e) => setSelectedSystemKey(e.target.value as SmsEventKey)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold"
            >
              {SYSTEM_EVENT_OPTIONS.map((ev) => (
                <option key={ev.key} value={ev.key}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {sourceKind === 'custom' && (
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              انتخاب قالب سفارشی ذخیره‌شده
            </label>
            {customTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-slate-500">
                هنوز قالب سفارشی ایجاد نشده است. ابتدا در تب «قالب‌ها و پترن‌ها» یک قالب بسازید.
              </div>
            ) : (
              <select
                value={selectedCustomId}
                onChange={(e) => setSelectedCustomId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold"
              >
                {customTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.send_mode === 'pattern' ? 'پترن' : 'متن دلخواه'})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {sourceKind === 'free' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                متن پیامک آزمایشی (قابل استفاده با متغیرها مانند <code dir="ltr">%name%</code>)
              </label>
              <textarea
                rows={3}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                کد پترن فراز اس‌ام‌اس (اختیاری — برای تست مستقیم پترن)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={freePatternCode}
                  onChange={(e) => setFreePatternCode(e.target.value)}
                  placeholder="خالی بگذارید برای ارسال متنی یا کد پترن وارد کنید"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-left focus:border-blue-600 focus:outline-none"
                />
                {provider && provider.patterns.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const code = e.target.value;
                      if (!code) return;
                      setFreePatternCode(code);
                      const pat = provider.patterns.find((p) => p.code === code);
                      if (pat?.text) setFreeText(pat.text);
                    }}
                    className="w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs"
                  >
                    <option value="">انتخاب پترن از پنل...</option>
                    {provider.patterns.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recipient Mobile + Mode Override + Line Override */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              شماره موبایل گیرنده <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              dir="ltr"
              required
              maxLength={11}
              value={recipientMobile}
              onChange={(e) => setRecipientMobile(e.target.value)}
              placeholder="09123456789"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              روش ارسال در این تست
            </label>
            <select
              value={modeOverride}
              onChange={(e) => setModeOverride(e.target.value as 'auto' | SmsSendMode)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-semibold"
            >
              <option value="auto">
                پیروی از قالب ({activeConfig.baseMode === 'pattern' ? 'پترن' : 'متن دلخواه'})
              </option>
              <option value="text">اجبار به متن دلخواه (Text)</option>
              <option value="pattern">اجبار به پترن (Pattern)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              خط فرستنده (اختیاری)
            </label>
            {provider && provider.lines.length > 0 ? (
              <select
                value={lineOverride}
                onChange={(e) => setLineOverride(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono tabular-nums"
              >
                <option value="">
                  پیش‌فرض سامانه ({settings.line_number || provider.lines[0].number})
                </option>
                {provider.lines.map((line) => (
                  <option key={line.number} value={line.number}>
                    {line.number} {line.title ? `(${line.title})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                dir="ltr"
                value={lineOverride}
                onChange={(e) => setLineOverride(e.target.value)}
                placeholder={settings.line_number || 'خودکار'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-left tabular-nums"
              />
            )}
          </div>
        </div>

        {/* Interactive Sample Variables Editor */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-extrabold text-slate-800 dark:text-slate-100">
                مقادیر نمونه متغیرهای قالب ({toPersianDigits(detectedTokens.length)} متغیر شناسایی‌شده)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                تغییر هر مقدار بلافاصله در پیش‌نمایش رندر شده و هنگام ارسال تست به وب‌سرویس ارسال می‌شود.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVariableValues(buildInitialSampleMap())}
              className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>بازنشانی نمونه</span>
            </button>
          </div>

          {detectedTokens.length === 0 ? (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-[11px] text-slate-500">
              این قالب فاقد متغیر پویا (`%...%`) است و عیناً با متن ثابت ارسال می‌شود.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detectedTokens.map((token) => {
                const meta = KNOWN_VARIABLES[token];
                return (
                  <div key={token} className="space-y-1">
                    <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <span>{meta?.label || token}</span>
                      <code dir="ltr" className="font-mono text-slate-400">
                        %{token}%
                      </code>
                    </label>
                    <input
                      type="text"
                      value={variableValues[token] ?? ''}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [token]: e.target.value }))
                      }
                      placeholder={meta?.sample || `مقدار ${token}`}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Primary Dispatch Submit Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
            <Coins className="w-3.5 h-3.5 text-slate-400" />
            <span>
              حالت مؤثر:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {effectiveMode === 'pattern'
                  ? `پترن (${activeConfig.patternCode})`
                  : 'متن دلخواه (Peer-to-Peer)'}
              </strong>
              {' · '}برآورد هزینه: {toPersianDigits(estimatedCost.toLocaleString('en-US'))} تومان
            </span>
          </div>

          <button
            type="submit"
            disabled={sending || (sourceKind === 'custom' && !activeCustomTemplate)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{sending ? 'در حال ارسال واقعی به فراز اس‌ام‌اس...' : 'ارسال پیامک آزمایشی زنده'}</span>
          </button>
        </div>
      </form>

      {/* Left Column (5 cols): Live Rendered Preview + API Diagnostics */}
      <div className="lg:col-span-5 space-y-5">
        {/* Live Rendered Preview Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
              پیش‌نمایش زنده پیامک رندرشده
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {toPersianDigits(renderedPreview.length)} کاراکتر · {toPersianDigits(previewPages)} صفحه
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-xs leading-7 text-slate-800 dark:text-slate-100 whitespace-pre-line min-h-[116px]">
            {renderedPreview || 'متنی برای پیش‌نمایش وجود ندارد.'}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            <span>
              گیرنده: <strong dir="ltr" className="font-mono text-slate-700 dark:text-slate-200">{recipientMobile || '—'}</strong>
            </span>
            <span>
              برآورد هزینه ارسال:{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {toPersianDigits(estimatedCost.toLocaleString('en-US'))} تومان
              </strong>
            </span>
          </div>
        </section>

        {/* Live API Diagnostics Output */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span>نتیجه تشخیصی اتصال و ارسال API</span>
            </h4>
            {diagnostic?.kind === 'dispatch' && (
              <button
                type="button"
                onClick={onNavigateLogs}
                className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده در گزارش تحویل</span>
                <ArrowUpLeft className="w-3 h-3" />
              </button>
            )}
          </div>

          {!diagnostic ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              برای مشاهده وضعیت اتصال، زمان پاسخ (Latency) و خروجی واقعی وب‌سرویس فراز اس‌ام‌اس، دکمه «تست سریع اتصال API» یا «ارسال پیامک آزمایشی زنده» را بزنید.
            </div>
          ) : diagnostic.kind === 'connectivity' ? (
            <div className="space-y-3">
              <div
                className={`rounded-lg border px-3.5 py-2.5 font-bold flex items-center gap-2 ${
                  diagnostic.connected
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                {diagnostic.connected ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {diagnostic.connected
                    ? 'اتصال به وب‌سرویس فراز اس‌ام‌اس برقرار و کلید API معتبر است.'
                    : diagnostic.error || 'عدم برقراری اتصال با فراز اس‌ام‌اس.'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] tabular-nums">
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">زمان پاسخ سرور</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {toPersianDigits(diagnostic.duration_ms)} ms
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">موجودی کیف پول</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {diagnostic.balance_toman !== null
                      ? `${toPersianDigits(diagnostic.balance_toman.toLocaleString('en-US'))} تومان`
                      : 'نامشخص'}
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">خطوط قابل دسترس</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {toPersianDigits(diagnostic.lines_count)} خط
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">پترن‌های تاییدشده</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {toPersianDigits(diagnostic.patterns_count)} الگو
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`rounded-lg border px-3.5 py-2.5 font-bold flex items-center gap-2 ${
                  diagnostic.success
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                {diagnostic.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {diagnostic.success
                    ? `پیامک آزمایشی با موفقیت به وب‌سرویس تحویل داده شد (${diagnostic.timestamp}).`
                    : diagnostic.error || 'ارسال پیامک آزمایشی ناموفق بود.'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11px] tabular-nums">
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">روش ارسال · خط</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {diagnostic.mode === 'pattern' ? 'پترن سریع' : 'متن دلخواه'} ·{' '}
                    <span dir="ltr" className="font-mono">
                      {diagnostic.line_number}
                    </span>
                  </div>
                </div>
                <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
                  <div className="text-slate-500">زمان پاسخ · هزینه</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {diagnostic.duration_ms !== undefined ? `${toPersianDigits(diagnostic.duration_ms)} ms` : '—'}
                    {' · '}
                    {toPersianDigits((diagnostic.estimated_cost_toman || 0).toLocaleString('en-US'))} تومان
                  </div>
                </div>
                {diagnostic.provider_ref && (
                  <div className="col-span-2 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                    <span className="text-slate-500">کد پیگیری وب‌سرویس (Ref)</span>
                    <span dir="ltr" className="font-mono font-bold text-slate-900 dark:text-white">
                      {diagnostic.provider_ref}
                    </span>
                  </div>
                )}
              </div>

              {diagnostic.provider_response && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawJson((prev) => !prev)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                  >
                    {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{showRawJson ? 'بستن پاسخ خام JSON فراز اس‌ام‌اس' : 'نمایش پاسخ خام JSON فراز اس‌ام‌اس'}</span>
                  </button>
                  {showRawJson && (
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 font-mono text-[10px] text-left text-slate-700 dark:text-slate-200"
                    >
                      {diagnostic.provider_response}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

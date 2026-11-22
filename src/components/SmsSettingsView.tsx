import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
  Wallet,
  Phone,
  FileCode2,
  Search,
  Save,
  Plus,
  Trash2,
  Clock,
  Sliders,
  ListChecks,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lock,
  Sparkles,
  X,
  BarChart3,
  FlaskConical,
} from 'lucide-react';
import {
  CUSTOM_SMS_TRIGGER_OPTIONS,
  CustomSmsTemplateRecord,
  CustomSmsTriggerKey,
  FarazProviderStatus,
  SmsAnalyticsData,
  SmsEventKey,
  SmsLogRecord,
  SmsLogsSummary,
  SmsSendMode,
  SmsSettingsConfig,
  SmsTemplateConfig,
} from '../types/recruitment.ts';
import { toPersianDigits } from '../utils/validation.ts';
import { SmsAnalyticsDashboardTab } from './SmsAnalyticsDashboardTab.tsx';
import { SmsTestSandboxTab } from './SmsTestSandboxTab.tsx';

type SmsSubTab = 'DASHBOARD' | 'TEST' | 'CONNECTION' | 'TEMPLATES' | 'LOGS';

type TemplateSelection =
  | { kind: 'system'; key: SmsEventKey }
  | { kind: 'custom'; id: number }
  | { kind: 'new' };

interface VariableOption {
  token: string;
  label: string;
  sample: string;
}

interface EventMeta {
  key: SmsEventKey;
  title: string;
  subtitle: string;
  defaultText: string;
  defaultVarMap: Record<string, string>;
  variables: VariableOption[];
}

const ALL_RECRUITMENT_VARIABLES: VariableOption[] = [
  { token: 'name', label: 'نام و نام خانوادگی', sample: 'نگار موسوی' },
  { token: 'national_code', label: 'کد ملی', sample: '1880452194' },
  { token: 'mobile', label: 'شماره موبایل', sample: '09164112288' },
  { token: 'status', label: 'وضعیت پرونده', sample: 'دعوت به مصاحبه' },
  { token: 'interview_date', label: 'تاریخ مصاحبه', sample: '۱۴۰۵/۰۹/۰۵' },
  { token: 'interview_time', label: 'ساعت مصاحبه', sample: '۱۰:۳۰' },
  { token: 'location', label: 'مکان مصاحبه', sample: 'دفتر مرکزی شرکت دستوا' },
  {
    token: 'interview_details',
    label: 'جزئیات کامل مصاحبه',
    sample: '\nزمان مصاحبه: ۱۴۰۵/۰۹/۰۵ ساعت ۱۰:۳۰\nمکان: دفتر مرکزی شرکت دستوا',
  },
  { token: 'job_title', label: 'عنوان شغلی', sample: 'کارمند اداری و دفتری' },
  { token: 'date', label: 'تاریخ و ساعت', sample: '۱۴۰۵/۰۸/۲۵ - ۱۰:۳۰' },
  { token: 'code', label: 'کد تایید ۶ رقمی', sample: '۴۸۲۹۱۵' },
];

const EVENT_METADATA: EventMeta[] = [
  {
    key: 'OTP',
    title: 'کد تایید دومرحله‌ای (OTP)',
    subtitle: 'ارسال کد ۶ رقمی برای ورود متقاضیان و ورود دومرحله‌ای مدیر',
    defaultText: 'کد تایید ورود به سامانه استخدام شرکت دستوا: %code%\nاعتبار کد: ۲ دقیقه',
    defaultVarMap: { code: 'code' },
    variables: [
      { token: 'code', label: 'کد تایید ۶ رقمی', sample: '۴۸۲۹۱۵' },
      { token: 'mobile', label: 'شماره موبایل', sample: '09164112288' },
      { token: 'date', label: 'تاریخ و ساعت', sample: '۱۴۰۵/۰۸/۲۵ - ۱۰:۳۰' },
    ],
  },
  {
    key: 'REGISTRATION_SUCCESS',
    title: 'تایید ثبت‌نام موفق متقاضی',
    subtitle: 'ارسال خودکار به متقاضی بلافاصله پس از ثبت نهایی فرم استخدام',
    defaultText:
      '%name% عزیز، ثبت‌نام شما در سامانه استخدام شرکت دستوا با موفقیت انجام شد. پیگیری وضعیت پرونده با کد ملی (%national_code%) و شماره موبایل از طریق درگاه سامانه امکان‌پذیر است.',
    defaultVarMap: { name: 'name', national_code: 'national_code' },
    variables: [
      { token: 'name', label: 'نام و نام خانوادگی', sample: 'نگار موسوی' },
      { token: 'national_code', label: 'کد ملی', sample: '1880452194' },
      { token: 'job_title', label: 'عنوان شغلی', sample: 'کارمند اداری و دفتری' },
      { token: 'date', label: 'تاریخ ثبت', sample: '۱۴۰۵/۰۸/۲۵ - ۱۰:۳۰' },
    ],
  },
  {
    key: 'STATUS_AND_INTERVIEW',
    title: 'تغییر وضعیت و دعوت به مصاحبه',
    subtitle: 'ارسال خودکار هنگام تغییر وضعیت پرونده (تکی/گروهی) یا تعیین زمان مصاحبه',
    defaultText:
      '%name% گرامی، وضعیت پرونده استخدامی شما در شرکت دستوا به «%status%» تغییر یافت.%interview_details%',
    defaultVarMap: { name: 'name', status: 'status' },
    variables: [
      { token: 'name', label: 'نام و نام خانوادگی', sample: 'نگار موسوی' },
      { token: 'status', label: 'وضعیت جدید پرونده', sample: 'دعوت به مصاحبه' },
      {
        token: 'interview_details',
        label: 'جزئیات کامل مصاحبه',
        sample: '\nزمان مصاحبه: ۱۴۰۵/۰۹/۰۵ ساعت ۱۰:۳۰\nمکان: دفتر مرکزی شرکت دستوا',
      },
      { token: 'interview_date', label: 'تاریخ مصاحبه', sample: '۱۴۰۵/۰۹/۰۵' },
      { token: 'interview_time', label: 'ساعت مصاحبه', sample: '۱۰:۳۰' },
      { token: 'location', label: 'مکان مصاحبه', sample: 'دفتر مرکزی شرکت دستوا' },
    ],
  },
  {
    key: 'ADMIN_NEW_APPLICANT',
    title: 'اطلاع‌رسانی به مدیر هنگام ثبت‌نام جدید',
    subtitle: 'ارسال پیامک فوری به شماره موبایل مدیر به محض ثبت درخواست جدید',
    defaultText:
      'ثبت‌نام متقاضی جدید در سامانه استخدام دستوا:\nنام: %name%\nکد ملی: %national_code%\nموبایل: %mobile%\nزمان: %date%',
    defaultVarMap: { name: 'name', mobile: 'mobile' },
    variables: [
      { token: 'name', label: 'نام متقاضی جدید', sample: 'نگار موسوی' },
      { token: 'national_code', label: 'کد ملی متقاضی', sample: '1880452194' },
      { token: 'mobile', label: 'موبایل متقاضی', sample: '09164112288' },
      { token: 'date', label: 'تاریخ ثبت‌نام', sample: '۱۴۰۵/۰۸/۲۵ - ۱۰:۳۰' },
    ],
  },
];

const SYSTEM_EVENT_LABELS: Record<string, string> = {
  OTP: 'کد تایید (OTP)',
  REGISTRATION_SUCCESS: 'ثبت‌نام موفق',
  STATUS_AND_INTERVIEW: 'تغییر وضعیت / مصاحبه',
  ADMIN_NEW_APPLICANT: 'اطلاع‌رسانی مدیر',
  TEST_SMS: 'پیامک آزمایشی',
};

function getEventDisplayLabel(eventType: string): string {
  if (SYSTEM_EVENT_LABELS[eventType]) return SYSTEM_EVENT_LABELS[eventType];
  if (eventType.startsWith('CUSTOM:')) {
    const key = eventType.slice('CUSTOM:'.length);
    const found = CUSTOM_SMS_TRIGGER_OPTIONS.find((o) => o.key === key);
    return found ? `سفارشی: ${found.label}` : `قالب سفارشی (${key})`;
  }
  return eventType;
}

function getTriggerLabel(triggerKey: CustomSmsTriggerKey): string {
  return CUSTOM_SMS_TRIGGER_OPTIONS.find((o) => o.key === triggerKey)?.label || 'سایر رویدادها';
}

function renderPreviewText(template: string, variables: VariableOption[]): string {
  const sampleMap: Record<string, string> = {};
  for (const v of ALL_RECRUITMENT_VARIABLES) {
    sampleMap[v.token] = v.sample;
  }
  for (const v of variables) {
    sampleMap[v.token] = v.sample;
  }
  return template.replace(/%([a-zA-Z0-9_]+)%/g, (_m, key: string) => sampleMap[key] ?? `%${key}%`);
}

function estimatePersianSmsPages(text: string): number {
  const len = text.length;
  if (len <= 70) return 1;
  return Math.ceil(len / 67);
}

interface CustomTemplateDraft {
  id?: number;
  title: string;
  trigger_key: CustomSmsTriggerKey;
  is_active: boolean;
  send_mode: SmsSendMode;
  pattern_code: string;
  pattern_var_map: Record<string, string>;
  text_template: string;
}

function createEmptyDraft(): CustomTemplateDraft {
  return {
    title: '',
    trigger_key: 'MANUAL_FOLLOWUP',
    is_active: true,
    send_mode: 'text',
    pattern_code: '',
    pattern_var_map: { name: 'name' },
    text_template: '%name% گرامی، جهت پیگیری پرونده استخدامی شما در شرکت دستوا با واحد منابع انسانی تماس بگیرید.',
  };
}

export const SmsSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SmsSubTab>('DASHBOARD');

  // Core SMS Settings, Provider status & Analytics
  const [settings, setSettings] = useState<SmsSettingsConfig | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<{
    configured: boolean;
    base_url: string;
    key_title: string;
    masked_key: string;
  } | null>(null);
  const [provider, setProvider] = useState<FarazProviderStatus | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [analytics, setAnalytics] = useState<SmsAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsToast, setSettingsToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Interactive Template Editor (CRUD) State
  const [customTemplates, setCustomTemplates] = useState<CustomSmsTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selection, setSelection] = useState<TemplateSelection>({ kind: 'system', key: 'OTP' });
  const [customDraft, setCustomDraft] = useState<CustomTemplateDraft>(createEmptyDraft());
  const [savingCustom, setSavingCustom] = useState(false);
  const [deletingCustomId, setDeletingCustomId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [templateToast, setTemplateToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick test-send inside Templates Tab
  const [quickTestMobile, setQuickTestMobile] = useState('');
  const [quickTestSending, setQuickTestSending] = useState(false);

  // Pattern var editor temp row
  const [newPatternVarName, setNewPatternVarName] = useState('');
  const [newPatternVarSource, setNewPatternVarSource] = useState('name');

  // Delivery Logs Tab State
  const [logs, setLogs] = useState<SmsLogRecord[]>([]);
  const [logsSummary, setLogsSummary] = useState<SmsLogsSummary>({
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    delivery_rate: 100,
  });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'sent' | 'failed' | 'skipped'>('ALL');
  const [logEventFilter, setLogEventFilter] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<number | null>(null);
  const [logToast, setLogToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sms/settings');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.connection) setConnectionInfo(data.connection);
    } catch {
      // ignore initial error
    }
  }, []);

  const fetchProviderStatus = useCallback(async () => {
    setLoadingProvider(true);
    try {
      const res = await fetch('/api/admin/sms/provider-info');
      const data = await res.json();
      if (data.provider) setProvider(data.provider);
    } catch {
      // ignore transient error
    } finally {
      setLoadingProvider(false);
    }
  }, []);

  const fetchCustomTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/admin/sms/templates');
      const data = await res.json();
      if (Array.isArray(data.templates)) {
        setCustomTemplates(data.templates);
      }
    } catch {
      // ignore transient error
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (logStatusFilter !== 'ALL') params.set('status', logStatusFilter);
      if (logEventFilter !== 'ALL') params.set('event_type', logEventFilter);
      if (logSearch.trim()) params.set('search', logSearch.trim());
      const res = await fetch(`/api/admin/sms/logs?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data.logs)) setLogs(data.logs);
      if (data.summary) setLogsSummary(data.summary);
    } catch {
      // ignore transient error
    } finally {
      setLoadingLogs(false);
    }
  }, [logStatusFilter, logEventFilter, logSearch]);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/admin/sms/analytics');
      const data = await res.json();
      if (data.analytics) setAnalytics(data.analytics);
    } catch {
      // ignore transient error
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchProviderStatus();
    fetchCustomTemplates();
    fetchAnalytics();
  }, [fetchSettings, fetchProviderStatus, fetchCustomTemplates, fetchAnalytics]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Keep custom draft synced when selecting an existing custom template
  const selectCustomTemplate = (tpl: CustomSmsTemplateRecord) => {
    setSelection({ kind: 'custom', id: tpl.id });
    setCustomDraft({
      id: tpl.id,
      title: tpl.title,
      trigger_key: tpl.trigger_key,
      is_active: tpl.is_active,
      send_mode: tpl.send_mode,
      pattern_code: tpl.pattern_code,
      pattern_var_map: { ...tpl.pattern_var_map },
      text_template: tpl.text_template,
    });
    setConfirmDeleteId(null);
    setTemplateToast(null);
    setNewPatternVarName('');
  };

  const startCreateNewTemplate = () => {
    setSelection({ kind: 'new' });
    setCustomDraft(createEmptyDraft());
    setConfirmDeleteId(null);
    setTemplateToast(null);
    setNewPatternVarName('');
  };

  const selectSystemTemplate = (key: SmsEventKey) => {
    setSelection({ kind: 'system', key });
    setConfirmDeleteId(null);
    setTemplateToast(null);
    setNewPatternVarName('');
    const meta = EVENT_METADATA.find((e) => e.key === key);
    if (meta && meta.variables.length > 0) {
      setNewPatternVarSource(meta.variables[0].token);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent, targetToast: 'settings' | 'template' = 'settings') => {
    if (e) e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    if (targetToast === 'settings') setSettingsToast(null);
    else setTemplateToast(null);

    try {
      const res = await fetch('/api/admin/sms/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        const msg =
          targetToast === 'template'
            ? 'تغییرات قالب سیستمی با موفقیت در پایگاه داده ذخیره شد.'
            : 'تنظیمات سامانه پیامکی فراز اس‌ام‌اس و احراز هویت دومرحله‌ای با موفقیت ذخیره شد.';
        if (targetToast === 'settings') setSettingsToast({ type: 'success', text: msg });
        else setTemplateToast({ type: 'success', text: msg });
      } else {
        const err = data.error || 'خطا در ذخیره‌سازی تنظیمات پیامکی.';
        if (targetToast === 'settings') setSettingsToast({ type: 'error', text: err });
        else setTemplateToast({ type: 'error', text: err });
      }
    } catch {
      const err = 'خطا در برقراری ارتباط با سرور.';
      if (targetToast === 'settings') setSettingsToast({ type: 'error', text: err });
      else setTemplateToast({ type: 'error', text: err });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveTariff = async (unitCostToman: number): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/sms/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_cost_toman: unitCostToman }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        await fetchAnalytics();
        return { ok: true };
      }
      return { ok: false, error: data.error || 'خطا در ذخیره تعرفه پیامک.' };
    } catch {
      return { ok: false, error: 'خطا در برقراری ارتباط با سرور.' };
    }
  };

  const handleSaveCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustom(true);
    setTemplateToast(null);
    try {
      const isNew = selection.kind === 'new' || !customDraft.id;
      const url = isNew ? '/api/admin/sms/templates' : `/api/admin/sms/templates/${customDraft.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customDraft),
      });
      const data = await res.json();
      if (res.ok && data.template) {
        await fetchCustomTemplates();
        selectCustomTemplate(data.template as CustomSmsTemplateRecord);
        setTemplateToast({
          type: 'success',
          text: isNew
            ? `قالب جدید «${data.template.title}» با موفقیت ایجاد شد.`
            : `تغییرات قالب «${data.template.title}» ذخیره شد.`,
        });
      } else {
        setTemplateToast({ type: 'error', text: data.error || 'خطا در ذخیره‌سازی قالب پیامک.' });
      }
    } catch {
      setTemplateToast({ type: 'error', text: 'خطا در برقراری ارتباط با سرور.' });
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDeleteCustomTemplate = async (id: number) => {
    setDeletingCustomId(id);
    setTemplateToast(null);
    try {
      const res = await fetch(`/api/admin/sms/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        const remaining = customTemplates.filter((t) => t.id !== id);
        setCustomTemplates(remaining);
        setConfirmDeleteId(null);
        if (remaining.length > 0) {
          selectCustomTemplate(remaining[0]);
        } else {
          selectSystemTemplate('OTP');
        }
        setTemplateToast({ type: 'success', text: 'قالب پیامکی سفارشی با موفقیت حذف شد.' });
      } else {
        setTemplateToast({ type: 'error', text: data.error || 'خطا در حذف قالب پیامک.' });
      }
    } catch {
      setTemplateToast({ type: 'error', text: 'خطا در برقراری ارتباط با سرور.' });
    } finally {
      setDeletingCustomId(null);
    }
  };

  const handleQuickTestCurrentTemplate = async () => {
    if (!quickTestMobile.trim()) {
      setTemplateToast({ type: 'error', text: 'لطفاً شماره موبایل گیرنده برای ارسال آزمایشی را وارد نمایید.' });
      return;
    }
    setQuickTestSending(true);
    setTemplateToast(null);
    try {
      let res: Response;
      if (selection.kind === 'system') {
        res = await fetch('/api/admin/sms/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: quickTestMobile.trim(),
            event_type: selection.key,
          }),
        });
      } else if (selection.kind === 'custom' && customDraft.id) {
        res = await fetch(`/api/admin/sms/templates/${customDraft.id}/send-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: quickTestMobile.trim(),
          }),
        });
      } else {
        setTemplateToast({
          type: 'error',
          text: 'ابتدا قالب جدید را ذخیره کنید، سپس پیامک آزمایشی ارسال نمایید.',
        });
        setQuickTestSending(false);
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setTemplateToast({
          type: 'success',
          text: `پیامک آزمایشی این قالب به ${quickTestMobile.trim()} ارسال شد (${data.result?.mode === 'pattern' ? 'پترن' : 'متن دلخواه'}${data.result?.provider_ref ? ` · کد پیگیری: ${data.result.provider_ref}` : ''}).`,
        });
      } else {
        setTemplateToast({
          type: 'error',
          text: data.error || data.result?.error || 'ارسال آزمایشی این قالب ناموفق بود.',
        });
      }
      fetchLogs();
      fetchAnalytics();
    } catch {
      setTemplateToast({ type: 'error', text: 'خطا در برقراری ارتباط با سرور برای تست قالب.' });
    } finally {
      setQuickTestSending(false);
    }
  };

  const handleRetryLog = async (logId: number) => {
    setRetryingLogId(logId);
    setLogToast(null);
    try {
      const res = await fetch(`/api/admin/sms/logs/${logId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogToast({
          type: 'success',
          text: `ارسال مجدد پیامک با موفقیت انجام شد${data.result?.provider_ref ? ` (کد پیگیری جدید: ${data.result.provider_ref})` : ''}.`,
        });
      } else {
        setLogToast({
          type: 'error',
          text: data.error || data.result?.error || 'ارسال مجدد پیامک ناموفق بود.',
        });
      }
      await Promise.all([fetchLogs(), fetchAnalytics()]);
    } catch {
      setLogToast({ type: 'error', text: 'خطا در برقراری ارتباط با سرور جهت ارسال مجدد.' });
    } finally {
      setRetryingLogId(null);
    }
  };

  const filteredSystemEvents = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return EVENT_METADATA;
    return EVENT_METADATA.filter(
      (ev) => ev.title.toLowerCase().includes(q) || ev.subtitle.toLowerCase().includes(q)
    );
  }, [templateSearch]);

  const filteredCustomTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return customTemplates;
    return customTemplates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.text_template.toLowerCase().includes(q) ||
        t.pattern_code.toLowerCase().includes(q) ||
        getTriggerLabel(t.trigger_key).toLowerCase().includes(q)
    );
  }, [customTemplates, templateSearch]);

  if (!settings) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500">
        در حال بارگذاری تنظیمات سامانه پیامکی فراز اس‌ام‌اس...
      </div>
    );
  }

  // Helpers for System Template Editing
  const activeSystemMeta =
    selection.kind === 'system'
      ? EVENT_METADATA.find((m) => m.key === selection.key) || EVENT_METADATA[0]
      : EVENT_METADATA[0];
  const activeSystemTemplate: SmsTemplateConfig = settings.templates[activeSystemMeta.key];

  const updateSystemTemplate = (patch: Partial<SmsTemplateConfig>) => {
    setSettings({
      ...settings,
      templates: {
        ...settings.templates,
        [activeSystemMeta.key]: {
          ...activeSystemTemplate,
          ...patch,
        },
      },
    });
  };

  const handleSelectPatternForSystem = (patternCode: string) => {
    const chosen = provider?.patterns.find((p) => p.code === patternCode);
    const nextMap: Record<string, string> = { ...activeSystemTemplate.pattern_var_map };
    if (chosen && chosen.vars && chosen.vars.length > 0) {
      const rebuilt: Record<string, string> = {};
      chosen.vars.forEach((v, idx) => {
        const defaultSource =
          activeSystemMeta.variables[idx]?.token || activeSystemMeta.variables[0]?.token || v;
        rebuilt[v] = activeSystemMeta.variables.some((m) => m.token === v) ? v : defaultSource;
      });
      updateSystemTemplate({ pattern_code: patternCode, pattern_var_map: rebuilt });
      return;
    }
    updateSystemTemplate({ pattern_code: patternCode, pattern_var_map: nextMap });
  };

  const handleSelectPatternForCustom = (patternCode: string) => {
    const chosen = provider?.patterns.find((p) => p.code === patternCode);
    if (chosen) {
      const rebuilt: Record<string, string> = {};
      const vars = chosen.vars && chosen.vars.length > 0 ? chosen.vars : [];
      vars.forEach((v, idx) => {
        const defaultSource =
          ALL_RECRUITMENT_VARIABLES[idx]?.token || ALL_RECRUITMENT_VARIABLES[0]?.token || 'name';
        rebuilt[v] = ALL_RECRUITMENT_VARIABLES.some((m) => m.token === v) ? v : defaultSource;
      });
      setCustomDraft((prev) => ({
        ...prev,
        send_mode: 'pattern',
        pattern_code: patternCode,
        pattern_var_map: Object.keys(rebuilt).length > 0 ? rebuilt : prev.pattern_var_map,
        text_template: prev.text_template.trim() ? prev.text_template : chosen.text || prev.text_template,
      }));
      return;
    }
    setCustomDraft((prev) => ({ ...prev, pattern_code: patternCode }));
  };

  const handleAddPatternVar = () => {
    const cleanVar = newPatternVarName.trim();
    if (!cleanVar) return;
    if (selection.kind === 'system') {
      updateSystemTemplate({
        pattern_var_map: {
          ...activeSystemTemplate.pattern_var_map,
          [cleanVar]: newPatternVarSource,
        },
      });
    } else {
      setCustomDraft((prev) => ({
        ...prev,
        pattern_var_map: {
          ...prev.pattern_var_map,
          [cleanVar]: newPatternVarSource,
        },
      }));
    }
    setNewPatternVarName('');
  };

  const handleRemovePatternVar = (keyToRemove: string) => {
    if (selection.kind === 'system') {
      const copy = { ...activeSystemTemplate.pattern_var_map };
      delete copy[keyToRemove];
      updateSystemTemplate({ pattern_var_map: copy });
    } else {
      setCustomDraft((prev) => {
        const copy = { ...prev.pattern_var_map };
        delete copy[keyToRemove];
        return { ...prev, pattern_var_map: copy };
      });
    }
  };

  const currentEditorText =
    selection.kind === 'system' ? activeSystemTemplate.text_template : customDraft.text_template;
  const currentEditorVars =
    selection.kind === 'system' ? activeSystemMeta.variables : ALL_RECRUITMENT_VARIABLES;
  const livePreviewText = renderPreviewText(currentEditorText, currentEditorVars);
  const livePreviewPages = estimatePersianSmsPages(livePreviewText);

  return (
    <div className="space-y-6">
      {/* Top Workspace Sub-Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              مدیریت سامانه پیامکی فراز اس‌ام‌اس (IranPayamak)
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
              <span>
                وضعیت وب‌سرویس:{' '}
                <strong
                  className={
                    provider?.connected
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }
                >
                  {loadingProvider ? 'در حال استعلام...' : provider?.connected ? 'متصل' : 'نیازمند بررسی'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                موجودی:{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {provider?.balance_toman !== null && provider?.balance_toman !== undefined
                    ? `${toPersianDigits(provider.balance_toman.toLocaleString('en-US'))} تومان`
                    : '—'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                قالب‌ها: {toPersianDigits(4 + customTemplates.length)}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Clean Functional Tabs */}
        <div
          role="tablist"
          aria-label="بخش‌های تنظیمات پیامک"
          className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'DASHBOARD'}
            onClick={() => {
              setActiveTab('DASHBOARD');
              fetchAnalytics();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>داشبورد و آمار</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'TEST'}
            onClick={() => setActiveTab('TEST')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'TEST'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>تست ارسال پیامک</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'CONNECTION'}
            onClick={() => setActiveTab('CONNECTION')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'CONNECTION'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>اتصال و 2FA</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'TEMPLATES'}
            onClick={() => setActiveTab('TEMPLATES')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'TEMPLATES'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>قالب‌ها و پترن‌ها</span>
            <span className="text-[11px] opacity-75 tabular-nums">
              ({toPersianDigits(4 + customTemplates.length)})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'LOGS'}
            onClick={() => {
              setActiveTab('LOGS');
              fetchLogs();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>گزارش تحویل</span>
            <span className="text-[11px] opacity-75 tabular-nums">
              ({toPersianDigits(logsSummary.total)})
            </span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: HIGH-LEVEL SMS ANALYTICS DASHBOARD                             */}
      {/* ===================================================================== */}
      {activeTab === 'DASHBOARD' && (
        <SmsAnalyticsDashboardTab
          analytics={analytics}
          loadingAnalytics={loadingAnalytics}
          provider={provider}
          loadingProvider={loadingProvider}
          onRefresh={() => {
            fetchAnalytics();
            fetchProviderStatus();
          }}
          onSaveTariff={handleSaveTariff}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DEDICATED SMS TEST SANDBOX                                     */}
      {/* ===================================================================== */}
      {activeTab === 'TEST' && (
        <SmsTestSandboxTab
          settings={settings}
          provider={provider}
          customTemplates={customTemplates}
          effectiveUnitCostToman={
            analytics?.overview.effective_unit_cost_toman ||
            (settings.unit_cost_toman > 0 ? settings.unit_cost_toman : provider?.derived_unit_cost_toman || 197)
          }
          onRefreshAfterSend={() => {
            fetchLogs();
            fetchAnalytics();
            fetchProviderStatus();
          }}
          onNavigateLogs={() => {
            setActiveTab('LOGS');
            fetchLogs();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CONNECTION & 2FA CONFIGURATION                                 */}
      {/* ===================================================================== */}
      {activeTab === 'CONNECTION' && (
        <div className="space-y-6">
          {/* Live Connection & Wallet Status Strip */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  وضعیت اتصال زنده به وب‌سرویس فراز اس‌ام‌اس
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span dir="ltr" className="font-mono">
                    {connectionInfo?.base_url || 'https://api.iranpayamak.com'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    عنوان کلید:{' '}
                    <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {connectionInfo?.key_title || 'emloyment'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    کلید سرور:{' '}
                    <strong dir="ltr" className="font-mono text-slate-700 dark:text-slate-200">
                      {connectionInfo?.configured ? connectionInfo.masked_key : 'تنظیم نشده'}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchProviderStatus}
                disabled={loadingProvider}
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProvider ? 'animate-spin' : ''}`} />
                <span>{loadingProvider ? 'در حال استعلام...' : 'استعلام زنده موجودی و خطوط'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 dark:divide-slate-800">
              <div className="pt-2 sm:pt-0 sm:pl-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">وضعیت ارتباط وب‌سرویس</div>
                <div className="flex items-center gap-1.5 text-sm font-extrabold">
                  {loadingProvider ? (
                    <span className="text-slate-500">در حال بررسی...</span>
                  ) : provider?.connected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-400">متصل و آماده ارسال</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-400">
                        {provider?.error ? 'نیازمند بررسی اتصال' : 'تنظیم‌شده روی سرور'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-3 sm:pt-0 sm:px-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                  <span>موجودی حساب فراز اس‌ام‌اس</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {provider?.balance_toman !== null && provider?.balance_toman !== undefined
                    ? `${toPersianDigits(provider.balance_toman.toLocaleString('en-US'))} تومان`
                    : 'نامشخص'}
                </div>
              </div>

              <div className="pt-3 sm:pt-0 sm:px-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>خطوط ارسال در دسترس</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {provider ? `${toPersianDigits(provider.lines.length)} خط فعال` : '—'}
                </div>
              </div>

              <div className="pt-3 sm:pt-0 sm:pr-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>پترن‌های ثبت‌شده در پنل</span>
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {provider ? `${toPersianDigits(provider.patterns.length)} الگو` : '—'}
                </div>
              </div>
            </div>

            {provider?.error && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  پاسخ وب‌سرویس فراز اس‌ام‌اس: {provider.error} — کلید دسترسی صرفاً در متغیر محیطی سرور (هدر{' '}
                  <code dir="ltr" className="font-mono">
                    Api-Key
                  </code>
                  ) نگهداری می‌شود.
                </span>
              </div>
            )}
          </section>

          {/* Global SMS Configuration & 2FA Settings Form */}
          <form onSubmit={(e) => handleSaveSettings(e, 'settings')}>
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>تنظیمات عمومی پیامک و احراز هویت دومرحله‌ای (2FA / OTP)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    پیکربندی خط فرستنده، روش ارسال پیش‌فرض و فعال‌سازی تایید دومرحله‌ای برای پرتال متقاضیان و پنل مدیریت.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sms_enabled}
                    onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span>فعال بودن کل سامانه پیامکی</span>
                </label>
              </div>

              {settingsToast && (
                <div
                  className={`rounded-lg border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
                    settingsToast.type === 'success'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {settingsToast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{settingsToast.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    روش ارسال پیش‌فرض پیامک
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, send_mode: 'pattern' })}
                      className={`py-2 px-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        settings.send_mode === 'pattern'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      پترن سریع (Pattern)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, send_mode: 'text' })}
                      className={`py-2 px-2 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        settings.send_mode === 'text'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      متن دلخواه (Text)
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    در صورت نبود کد پترن برای یک رویداد، ارسال خودکار با متن دلخواه انجام می‌شود.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    شماره خط فرستنده (Line Number)
                  </label>
                  {provider && provider.lines.length > 0 ? (
                    <select
                      value={settings.line_number}
                      onChange={(e) => setSettings({ ...settings, line_number: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono tabular-nums focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">انتخاب خودکار اولین خط فعال</option>
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
                      value={settings.line_number}
                      onChange={(e) => setSettings({ ...settings, line_number: e.target.value })}
                      placeholder="مثلاً 90008361 یا خالی برای خودکار"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
                    />
                  )}
                  <p className="text-[11px] text-slate-500">
                    با خالی گذاشتن، اولین خط فعال پنل فراز اس‌ام‌اس انتخاب می‌شود.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    شماره موبایل مدیر سامانه
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    maxLength={11}
                    value={settings.admin_mobile}
                    onChange={(e) => setSettings({ ...settings, admin_mobile: e.target.value })}
                    placeholder="09120000000"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    برای دریافت کد 2FA ورود به <code dir="ltr">/admin</code> و هشدار ثبت‌نام جدید.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    فرمت نمایش ارقام در پیامک
                  </label>
                  <select
                    value={settings.number_format}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        number_format: e.target.value === 'english' ? 'english' : 'persian',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                  >
                    <option value="persian">ارقام فارسی (persian)</option>
                    <option value="english">ارقام انگلیسی (english)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    تنظیم پارامتر <code dir="ltr">number_format</code> در وب‌سرویس فراز اس‌ام‌اس.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                <div className="lg:col-span-4">
                  <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.applicant_2fa_enabled}
                      onChange={(e) =>
                        setSettings({ ...settings, applicant_2fa_enabled: e.target.checked })
                      }
                      className="mt-0.5 w-4 h-4 accent-blue-600"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        احراز هویت دومرحله‌ای پرتال متقاضیان (OTP)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        متقاضیان پیش از شروع ثبت‌نام یا مشاهده وضعیت پرونده باید کد ۶ رقمی پیامکی را تایید کنند.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="lg:col-span-4">
                  <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.admin_2fa_enabled}
                      onChange={(e) => setSettings({ ...settings, admin_2fa_enabled: e.target.checked })}
                      className="mt-0.5 w-4 h-4 accent-blue-600"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        احراز هویت دومرحله‌ای ورود مدیر (/admin)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        پس از وارد کردن نام کاربری و رمز عبور، کد ۶ رقمی به شماره موبایل مدیر ارسال می‌شود.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="lg:col-span-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>اعتبار کد OTP (ثانیه)</span>
                    </label>
                    <input
                      type="number"
                      min={60}
                      max={600}
                      value={settings.otp_expiry_seconds}
                      onChange={(e) =>
                        setSettings({ ...settings, otp_expiry_seconds: Number(e.target.value) || 120 })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      فاصله ارسال مجدد (ثانیه)
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={settings.otp_resend_seconds}
                      onChange={(e) =>
                        setSettings({ ...settings, otp_resend_seconds: Number(e.target.value) || 60 })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 tabular-nums">
                  {settings.updated_at_jalali
                    ? `آخرین ذخیره تنظیمات: ${settings.updated_at_jalali}`
                    : 'هنوز تغییری ذخیره نشده است.'}
                </div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات اتصال و 2FA'}</span>
                </button>
              </div>
            </section>
          </form>

          {/* Shortcut to Dedicated SMS Test Sandbox Tab */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-600" />
                <span>نیاز به آزمایش اتصال، رندر متغیرها و مشاهده پاسخ JSON دارید؟</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                از آزمایشگاه اختصاصی تست پیامک برای ارسال نمونه با هر قالب (سیستمی، سفارشی یا آزاد) استفاده کنید.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('TEST')}
              className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ورود به آزمایشگاه تست پیامک</span>
            </button>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: INTERACTIVE TEMPLATE & PATTERN CRUD EDITOR                     */}
      {/* ===================================================================== */}
      {activeTab === 'TEMPLATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Sidebar (4 cols): Template Directory & Create CTA */}
          <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                فهرست قالب‌های پیامکی
              </h3>
              <button
                type="button"
                onClick={startCreateNewTemplate}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ایجاد قالب جدید</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="جستجوی عنوان، متن یا کد پترن..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pr-8 pl-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Section 1: 4 Protected System Templates */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>قالب‌های خودکار سیستمی</span>
                </span>
                <span className="tabular-nums">{toPersianDigits(filteredSystemEvents.length)}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {filteredSystemEvents.map((ev) => {
                  const cfg = settings.templates[ev.key];
                  const isSelected = selection.kind === 'system' && selection.key === ev.key;
                  const effectiveMode =
                    (cfg.send_mode_override === 'pattern' ||
                      (cfg.send_mode_override === 'default' && settings.send_mode === 'pattern')) &&
                    cfg.pattern_code.trim()
                      ? 'پترن'
                      : 'متن دلخواه';
                  return (
                    <button
                      key={ev.key}
                      type="button"
                      onClick={() => selectSystemTemplate(ev.key)}
                      className={`w-full text-right px-3.5 py-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-r-2 border-r-blue-600'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <span className={cfg.enabled ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}>
                          {cfg.enabled ? 'فعال' : 'غیرفعال'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{effectiveMode}</span>
                        {cfg.pattern_code && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span dir="ltr" className="font-mono text-[10px]">
                              {cfg.pattern_code}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Custom Admin Templates (CRUD) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>قالب‌های سفارشی مدیر (قابل ایجاد/حذف)</span>
                </span>
                <span className="tabular-nums">{toPersianDigits(filteredCustomTemplates.length)}</span>
              </div>

              {loadingTemplates ? (
                <div className="text-xs text-slate-500 text-center py-6 border border-slate-200 dark:border-slate-800 rounded-lg">
                  در حال بارگذاری قالب‌ها...
                </div>
              ) : filteredCustomTemplates.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-6 px-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg space-y-2">
                  <div>هیچ قالب سفارشی مطابقی یافت نشد.</div>
                  <button
                    type="button"
                    onClick={startCreateNewTemplate}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    + ساخت اولین قالب سفارشی
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  {filteredCustomTemplates.map((tpl) => {
                    const isSelected = selection.kind === 'custom' && selection.id === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => selectCustomTemplate(tpl)}
                        className={`w-full text-right px-3.5 py-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-r-2 border-r-blue-600'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              tpl.is_active
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'text-slate-400'
                            }
                          >
                            {tpl.is_active ? 'فعال' : 'غیرفعال'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{getTriggerLabel(tpl.trigger_key)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tpl.send_mode === 'pattern' ? 'پترن' : 'متن دلخواه'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Left Workspace (8 cols): Interactive Editor + Live Preview + Quick Test */}
          <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            {templateToast && (
              <div
                className={`rounded-lg border px-4 py-3 text-xs font-bold flex items-center justify-between gap-2 ${
                  templateToast.type === 'success'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {templateToast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{templateToast.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTemplateToast(null)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  aria-label="بستن پیام"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SYSTEM TEMPLATE FORM */}
            {selection.kind === 'system' ? (
              <div className="space-y-5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      قالب خودکار سیستمی · غیرقابل حذف
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {activeSystemMeta.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {activeSystemMeta.subtitle}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeSystemTemplate.enabled}
                      onChange={(e) => updateSystemTemplate({ enabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span>فعال بودن ارسال این رویداد</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      روش ارسال این رویداد
                    </label>
                    <select
                      value={activeSystemTemplate.send_mode_override}
                      onChange={(e) =>
                        updateSystemTemplate({
                          send_mode_override: e.target.value as 'default' | SmsSendMode,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                    >
                      <option value="default">
                        پیروی از پیش‌فرض سامانه ({settings.send_mode === 'pattern' ? 'پترن سریع' : 'متن دلخواه'})
                      </option>
                      <option value="pattern">ارسال اختصاصی با پترن (Pattern)</option>
                      <option value="text">ارسال اختصاصی با متن دلخواه (Text)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      کد پترن فراز اس‌ام‌اس (Pattern Code / UID)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={activeSystemTemplate.pattern_code}
                        onChange={(e) => updateSystemTemplate({ pattern_code: e.target.value })}
                        placeholder="مثلاً SJ3FgPrE0C"
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-left focus:border-blue-600 focus:outline-none"
                      />
                      {provider && provider.patterns.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleSelectPatternForSystem(e.target.value);
                          }}
                          className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs"
                        >
                          <option value="">انتخاب از پنل...</option>
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

                {/* Pattern Variable Mapping */}
                {(activeSystemTemplate.pattern_code.trim().length > 0 ||
                  activeSystemTemplate.send_mode_override === 'pattern' ||
                  (activeSystemTemplate.send_mode_override === 'default' &&
                    settings.send_mode === 'pattern')) && (
                  <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">
                      نگاشت متغیرهای پترن (Pattern Attributes)
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(activeSystemTemplate.pattern_var_map).map(
                        ([patternKey, sourceVar]) => (
                          <div key={patternKey} className="flex items-center gap-2">
                            <input
                              type="text"
                              dir="ltr"
                              readOnly
                              value={patternKey}
                              className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 font-mono text-left"
                            />
                            <span className="text-slate-400">←</span>
                            <select
                              value={sourceVar}
                              onChange={(e) =>
                                updateSystemTemplate({
                                  pattern_var_map: {
                                    ...activeSystemTemplate.pattern_var_map,
                                    [patternKey]: e.target.value,
                                  },
                                })
                              }
                              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                            >
                              {activeSystemMeta.variables.map((v) => (
                                <option key={v.token} value={v.token}>
                                  {v.label} (%{v.token}%)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemovePatternVar(patternKey)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="حذف متغیر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          dir="ltr"
                          value={newPatternVarName}
                          onChange={(e) => setNewPatternVarName(e.target.value)}
                          placeholder="نام متغیر پترن (مثلاً code)"
                          className="w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-mono text-left"
                        />
                        <select
                          value={newPatternVarSource}
                          onChange={(e) => setNewPatternVarSource(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                        >
                          {activeSystemMeta.variables.map((v) => (
                            <option key={v.token} value={v.token}>
                              {v.label} (%{v.token}%)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddPatternVar}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Editable Plain-Text Template */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      متن پیامک قابل ویرایش
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeSystemMeta.variables.map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() =>
                            updateSystemTemplate({
                              text_template: activeSystemTemplate.text_template
                                ? `${activeSystemTemplate.text_template} %${v.token}%`
                                : `%${v.token}%`,
                            })
                          }
                          className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          + {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={activeSystemTemplate.text_template}
                    onChange={(e) => updateSystemTemplate({ text_template: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {/* Live Preview Box */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">
                      پیش‌نمایش زنده متن نهایی
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {toPersianDigits(livePreviewText.length)} کاراکتر ·{' '}
                      {toPersianDigits(livePreviewPages)} صفحه پیامک
                    </span>
                  </div>
                  <div className="text-xs leading-7 text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {livePreviewText}
                  </div>
                </div>

                {/* Inline Quick Test Send + Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      dir="ltr"
                      maxLength={11}
                      value={quickTestMobile}
                      onChange={(e) => setQuickTestMobile(e.target.value)}
                      placeholder="تست ارسال: 09123456789"
                      className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleQuickTestCurrentTemplate}
                      disabled={quickTestSending}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{quickTestSending ? 'در حال ارسال...' : 'تست ارسال'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSystemTemplate({
                          text_template: activeSystemMeta.defaultText,
                          pattern_var_map: { ...activeSystemMeta.defaultVarMap },
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازنشانی پیش‌فرض</span>
                    </button>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={() => handleSaveSettings(undefined, 'template')}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSettings ? 'در حال ذخیره...' : 'ذخیره قالب سیستمی'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* CUSTOM TEMPLATE CREATE / EDIT FORM (CRUD) */
              <form onSubmit={handleSaveCustomTemplate} className="space-y-5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {selection.kind === 'new'
                        ? 'ایجاد قالب پیامکی جدید'
                        : `ویرایش قالب سفارشی #${toPersianDigits(customDraft.id || 0)}`}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {customDraft.title.trim() || 'قالب پیامکی جدید بدون عنوان'}
                    </h3>
                  </div>

                  <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customDraft.is_active}
                      onChange={(e) =>
                        setCustomDraft((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span>قالب فعال باشد</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      عنوان قالب پیامک <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customDraft.title}
                      onChange={(e) =>
                        setCustomDraft((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="مثلاً: یادآوری ۲۴ ساعته مصاحبه حضوری"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      رویداد / کاربرد قالب (Notification Trigger)
                    </label>
                    <select
                      value={customDraft.trigger_key}
                      onChange={(e) =>
                        setCustomDraft((prev) => ({
                          ...prev,
                          trigger_key: e.target.value as CustomSmsTriggerKey,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                    >
                      {CUSTOM_SMS_TRIGGER_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      روش ارسال پیامک
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          setCustomDraft((prev) => ({ ...prev, send_mode: 'text' }))
                        }
                        className={`py-1.5 px-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                          customDraft.send_mode === 'text'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        متن دلخواه (Text)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomDraft((prev) => ({ ...prev, send_mode: 'pattern' }))
                        }
                        className={`py-1.5 px-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                          customDraft.send_mode === 'pattern'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        پترن سریع (Pattern)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      کد پترن فراز اس‌ام‌اس (در حالت پترن)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={customDraft.pattern_code}
                        onChange={(e) =>
                          setCustomDraft((prev) => ({ ...prev, pattern_code: e.target.value }))
                        }
                        placeholder="مثلاً SJ3FgPrE0C"
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-left focus:border-blue-600 focus:outline-none"
                      />
                      {provider && provider.patterns.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleSelectPatternForCustom(e.target.value);
                          }}
                          className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs"
                        >
                          <option value="">انتخاب از پنل...</option>
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

                {/* Pattern Attribute Mapper when pattern mode or pattern_code filled */}
                {(customDraft.send_mode === 'pattern' ||
                  customDraft.pattern_code.trim().length > 0) && (
                  <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">
                      نگاشت متغیرهای پترن (Pattern Attributes)
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(customDraft.pattern_var_map).map(
                        ([patternKey, sourceVar]) => (
                          <div key={patternKey} className="flex items-center gap-2">
                            <input
                              type="text"
                              dir="ltr"
                              readOnly
                              value={patternKey}
                              className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 font-mono text-left"
                            />
                            <span className="text-slate-400">←</span>
                            <select
                              value={sourceVar}
                              onChange={(e) =>
                                setCustomDraft((prev) => ({
                                  ...prev,
                                  pattern_var_map: {
                                    ...prev.pattern_var_map,
                                    [patternKey]: e.target.value,
                                  },
                                }))
                              }
                              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                            >
                              {ALL_RECRUITMENT_VARIABLES.map((v) => (
                                <option key={v.token} value={v.token}>
                                  {v.label} (%{v.token}%)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemovePatternVar(patternKey)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="حذف متغیر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          dir="ltr"
                          value={newPatternVarName}
                          onChange={(e) => setNewPatternVarName(e.target.value)}
                          placeholder="نام متغیر پترن (مثلاً var1)"
                          className="w-40 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-mono text-left"
                        />
                        <select
                          value={newPatternVarSource}
                          onChange={(e) => setNewPatternVarSource(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
                        >
                          {ALL_RECRUITMENT_VARIABLES.map((v) => (
                            <option key={v.token} value={v.token}>
                              {v.label} (%{v.token}%)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddPatternVar}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Editable Text Body + 1-click Variable Insertion */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      متن پیامک (پشتیبانی از متغیرهای پویا)
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      {ALL_RECRUITMENT_VARIABLES.slice(0, 8).map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() =>
                            setCustomDraft((prev) => ({
                              ...prev,
                              text_template: prev.text_template
                                ? `${prev.text_template} %${v.token}%`
                                : `%${v.token}%`,
                            }))
                          }
                          className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          + {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    required={customDraft.send_mode === 'text'}
                    value={customDraft.text_template}
                    onChange={(e) =>
                      setCustomDraft((prev) => ({ ...prev, text_template: e.target.value }))
                    }
                    placeholder="متن پیامک فارسی خود را اینجا بنویسید..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs leading-relaxed focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {/* Live Preview */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">
                      پیش‌نمایش زنده متن نهایی
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {toPersianDigits(livePreviewText.length)} کاراکتر ·{' '}
                      {toPersianDigits(livePreviewPages)} صفحه پیامک
                    </span>
                  </div>
                  <div className="text-xs leading-7 text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {livePreviewText || 'متنی وارد نشده است.'}
                  </div>
                </div>

                {/* Footer Actions: Quick Test + Delete (with inline confirm) + Save */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  {selection.kind === 'custom' && customDraft.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        dir="ltr"
                        maxLength={11}
                        value={quickTestMobile}
                        onChange={(e) => setQuickTestMobile(e.target.value)}
                        placeholder="تست ارسال: 09123456789"
                        className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleQuickTestCurrentTemplate}
                        disabled={quickTestSending}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer disabled:opacity-60"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{quickTestSending ? 'در حال ارسال...' : 'تست ارسال'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      پس از ایجاد قالب، امکان ارسال آزمایشی مستقیم فعال می‌شود.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {selection.kind === 'custom' && customDraft.id && (
                      <>
                        {confirmDeleteId === customDraft.id ? (
                          <div className="flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5">
                            <span className="text-rose-700 dark:text-rose-300 font-bold">حذف شود؟</span>
                            <button
                              type="button"
                              disabled={deletingCustomId === customDraft.id}
                              onClick={() => handleDeleteCustomTemplate(customDraft.id!)}
                              className="rounded bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 font-bold cursor-pointer"
                            >
                              {deletingCustomId === customDraft.id ? '...' : 'بله، حذف'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              انصراف
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(customDraft.id!)}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-2 font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف قالب</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={savingCustom}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {savingCustom
                          ? 'در حال ذخیره...'
                          : selection.kind === 'new'
                          ? 'ثبت و ایجاد قالب'
                          : 'ذخیره تغییرات قالب'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DEDICATED SMS DELIVERY LOGS TAB                                */}
      {/* ===================================================================== */}
      {activeTab === 'LOGS' && (
        <div className="space-y-6">
          {/* 4-Column Delivery KPI Summary Strip */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 dark:divide-slate-800">
              <div className="pt-1 sm:pt-0 sm:pl-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">کل پیامک‌های ثبت‌شده</div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {toPersianDigits(logsSummary.total)}
                </div>
              </div>
              <div className="pt-1 sm:pt-0 sm:px-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">ارسال موفق (تحویل به وب‌سرویس)</div>
                <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                  {toPersianDigits(logsSummary.sent)}
                </div>
              </div>
              <div className="pt-3 lg:pt-0 sm:px-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">ارسال ناموفق (قابل ارسال مجدد)</div>
                <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
                  {toPersianDigits(logsSummary.failed)}
                </div>
              </div>
              <div className="pt-3 lg:pt-0 sm:pr-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">نرخ موفقیت ارسال</div>
                <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                  {toPersianDigits(logsSummary.delivery_rate)}٪
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Logs Table Card */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  جدول گزارش تحویل پیامک‌ها (Delivery Logs)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  رهگیری وضعیت تحویل، زمان ارسال، شماره گیرنده، متن کامل و ارسال مجدد پیامک‌های ناموفق.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="جستجو موبایل، متن، کد پیگیری..."
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pr-8 pl-3 py-1.5 text-xs w-52 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <select
                  value={logStatusFilter}
                  onChange={(e) =>
                    setLogStatusFilter(e.target.value as 'ALL' | 'sent' | 'failed' | 'skipped')
                  }
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">همه وضعیت‌ها</option>
                  <option value="sent">ارسال موفق</option>
                  <option value="failed">ناموفق</option>
                  <option value="skipped">رد شده (غیرفعال)</option>
                </select>

                <select
                  value={logEventFilter}
                  onChange={(e) => setLogEventFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">همه رویدادها</option>
                  <option value="OTP">کد تایید (OTP)</option>
                  <option value="REGISTRATION_SUCCESS">ثبت‌نام موفق</option>
                  <option value="STATUS_AND_INTERVIEW">تغییر وضعیت / مصاحبه</option>
                  <option value="ADMIN_NEW_APPLICANT">اطلاع‌رسانی مدیر</option>
                  <option value="TEST_SMS">پیامک آزمایشی</option>
                  <option value="CUSTOM_ONLY">قالب‌های سفارشی</option>
                </select>

                <button
                  type="button"
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>بروزرسانی</span>
                </button>
              </div>
            </div>

            {logToast && (
              <div
                className={`rounded-lg border px-4 py-3 text-xs font-bold flex items-center justify-between gap-2 ${
                  logToast.type === 'success'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {logToast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{logToast.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogToast(null)}
                  className="opacity-70 hover:opacity-100 cursor-pointer"
                  aria-label="بستن پیام"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">زمان ارسال</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">گیرنده</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">رویداد · روش</th>
                    <th className="py-2.5 px-3 font-bold">محتوای پیام</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">وضعیت تحویل</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        {loadingLogs
                          ? 'در حال دریافت گزارش پیامک‌ها...'
                          : 'هیچ گزارش پیامکی مطابق با فیلتر فعلی ثبت نشده است.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                              {log.created_at_jalali || '—'}
                            </td>
                            <td
                              dir="ltr"
                              className="py-3 px-3 whitespace-nowrap font-mono tabular-nums text-right text-slate-900 dark:text-white font-semibold"
                            >
                              {log.recipient_mobile}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              <span className="font-bold">{getEventDisplayLabel(log.event_type)}</span>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="text-slate-500">
                                {log.send_mode === 'pattern' ? 'پترن' : 'متن دلخواه'}
                              </span>
                            </td>
                            <td className="py-3 px-3 max-w-md text-slate-700 dark:text-slate-300">
                              <div className="line-clamp-2 leading-relaxed">{log.message_text}</div>
                              {log.error_message && (
                                <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 line-clamp-1">
                                  {log.error_message}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {log.status === 'sent' ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>ارسال موفق</span>
                                </span>
                              ) : log.status === 'failed' ? (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>ناموفق</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  <span>رد شده</span>
                                </span>
                              )}
                              {log.provider_ref && (
                                <div
                                  dir="ltr"
                                  className="text-[10px] font-mono text-slate-400 mt-0.5 text-right tabular-nums"
                                >
                                  Ref: {log.provider_ref}
                                </div>
                              )}
                            </td>
                            <td
                              className="py-3 px-3 whitespace-nowrap text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center gap-2">
                                {log.status === 'failed' && (
                                  <button
                                    type="button"
                                    disabled={retryingLogId === log.id}
                                    onClick={() => handleRetryLog(log.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer disabled:opacity-60"
                                  >
                                    <RotateCcw
                                      className={`w-3 h-3 ${retryingLogId === log.id ? 'animate-spin' : ''}`}
                                    />
                                    <span>{retryingLogId === log.id ? 'ارسال...' : 'ارسال مجدد'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  aria-label="جزئیات پیامک"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50 dark:bg-slate-800/40">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                                  <div className="lg:col-span-7 space-y-1.5">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                      متن کامل پیامک ارسال‌شده
                                    </div>
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 leading-6 text-slate-800 dark:text-slate-200 whitespace-pre-line">
                                      {log.message_text || '—'}
                                    </div>
                                  </div>
                                  <div className="lg:col-span-5 space-y-2">
                                    <div className="font-bold text-slate-700 dark:text-slate-300">
                                      اطلاعات فنی وب‌سرویس فراز اس‌ام‌اس
                                    </div>
                                    <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                                      <div>
                                        شناسه گزارش:{' '}
                                        <span className="font-mono tabular-nums">#{log.id}</span> · خط فرستنده:{' '}
                                        <span dir="ltr" className="font-mono tabular-nums">
                                          {log.line_number || '—'}
                                        </span>
                                      </div>
                                      {log.pattern_code && (
                                        <div>
                                          کد پترن:{' '}
                                          <span dir="ltr" className="font-mono">
                                            {log.pattern_code}
                                          </span>
                                        </div>
                                      )}
                                      {log.provider_ref && (
                                        <div>
                                          کد پیگیری (Ref):{' '}
                                          <span dir="ltr" className="font-mono tabular-nums">
                                            {log.provider_ref}
                                          </span>
                                        </div>
                                      )}
                                      {log.error_message && (
                                        <div className="text-rose-600 dark:text-rose-400 font-semibold">
                                          پیام خطا: {log.error_message}
                                        </div>
                                      )}
                                      {log.provider_response && (
                                        <pre
                                          dir="ltr"
                                          className="mt-1.5 max-h-28 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 font-mono text-[10px] text-left text-slate-600 dark:text-slate-300"
                                        >
                                          {log.provider_response}
                                        </pre>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

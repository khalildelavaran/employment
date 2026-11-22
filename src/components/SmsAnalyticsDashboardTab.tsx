import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  RefreshCw,
  Send,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Coins,
  Save,
  RotateCcw,
  AlertCircle,
  ArrowUpLeft,
} from 'lucide-react';
import { FarazProviderStatus, SmsAnalyticsData } from '../types/recruitment.ts';
import { toPersianDigits } from '../utils/validation.ts';

interface SmsAnalyticsDashboardTabProps {
  analytics: SmsAnalyticsData | null;
  loadingAnalytics: boolean;
  provider: FarazProviderStatus | null;
  loadingProvider: boolean;
  onRefresh: () => void;
  onSaveTariff: (unitCostToman: number) => Promise<{ ok: boolean; error?: string }>;
  onNavigateTab: (tab: 'TEST' | 'LOGS' | 'CONNECTION' | 'TEMPLATES') => void;
}

const DELIVERY_COLORS = {
  sent: '#16A34A',
  failed: '#DC2626',
  skipped: '#94A3B8',
};

function formatToman(val: number): string {
  return `${toPersianDigits(Math.round(val).toLocaleString('en-US'))} تومان`;
}

export const SmsAnalyticsDashboardTab: React.FC<SmsAnalyticsDashboardTabProps> = ({
  analytics,
  loadingAnalytics,
  provider,
  loadingProvider,
  onRefresh,
  onSaveTariff,
  onNavigateTab,
}) => {
  const [tariffInput, setTariffInput] = useState<string>('');
  const [savingTariff, setSavingTariff] = useState(false);
  const [tariffFeedback, setTariffFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (analytics) {
      setTariffInput(
        analytics.overview.manual_unit_cost_toman > 0
          ? String(analytics.overview.manual_unit_cost_toman)
          : ''
      );
    }
  }, [analytics]);

  const handleTariffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTariff(true);
    setTariffFeedback(null);
    const parsed = tariffInput.trim() === '' ? 0 : Math.max(0, Math.round(Number(tariffInput) || 0));
    const res = await onSaveTariff(parsed);
    if (res.ok) {
      setTariffFeedback({
        type: 'success',
        text:
          parsed > 0
            ? `تعرفه پایه دستی روی ${formatToman(parsed)} به ازای هر صفحه پیامک ذخیره شد.`
            : 'محاسبه هزینه به حالت خودکار (تعرفه زنده فراز اس‌ام‌اس) بازگردانده شد.',
      });
    } else {
      setTariffFeedback({ type: 'error', text: res.error || 'خطا در ذخیره تعرفه پیامک.' });
    }
    setSavingTariff(false);
  };

  const handleResetAutoTariff = async () => {
    setTariffInput('');
    setSavingTariff(true);
    setTariffFeedback(null);
    const res = await onSaveTariff(0);
    if (res.ok) {
      setTariffFeedback({
        type: 'success',
        text: 'محاسبه هزینه به تعرفه خودکار وب‌سرویس فراز اس‌ام‌اس بازنشانی شد.',
      });
    } else {
      setTariffFeedback({ type: 'error', text: res.error || 'خطا در بازنشانی تعرفه.' });
    }
    setSavingTariff(false);
  };

  if (!analytics && loadingAnalytics) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
        در حال تحلیل آمار و هزینه‌های ارسال پیامک...
      </div>
    );
  }

  const ov = analytics?.overview || {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    delivery_rate: 100,
    total_pages: 0,
    total_spend_toman: 0,
    current_month_label: 'ماه جاری',
    current_month_sent: 0,
    current_month_pages: 0,
    current_month_spend_toman: 0,
    effective_unit_cost_toman: 197,
    tariff_source: 'fallback' as const,
    auto_unit_cost_toman: null,
    manual_unit_cost_toman: 0,
  };

  const monthlyTrend = analytics?.monthly_trend || [];
  const byEvent = analytics?.by_event || [];
  const byMode = analytics?.by_mode || [];

  const deliveryPieData = [
    { name: 'ارسال موفق', value: ov.sent, color: DELIVERY_COLORS.sent },
    { name: 'ناموفق', value: ov.failed, color: DELIVERY_COLORS.failed },
    { name: 'ردشده (غیرفعال)', value: ov.skipped, color: DELIVERY_COLORS.skipped },
  ].filter((d) => d.value > 0);

  const estimatedRemainingPages =
    provider?.balance_count != null
      ? provider.balance_count
      : provider?.balance_toman != null && ov.effective_unit_cost_toman > 0
      ? Math.floor(provider.balance_toman / ov.effective_unit_cost_toman)
      : null;

  return (
    <div className="space-y-6">
      {/* 1. 4-Column Executive KPI Strip (Single-Elevation) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 dark:divide-slate-800">
          <div className="pt-1 sm:pt-0 sm:pl-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>کل پیامک‌های ثبت‌شده</span>
              <Send className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
              {toPersianDigits(ov.total.toLocaleString('en-US'))}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {toPersianDigits(ov.sent)} موفق · {toPersianDigits(ov.total_pages)} صفحه مصرفی
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:px-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>نرخ موفقیت تحویل</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
              {toPersianDigits(ov.delivery_rate)}٪
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {toPersianDigits(ov.failed)} ناموفق · {toPersianDigits(ov.skipped)} ردشده
            </div>
          </div>

          <div className="pt-4 lg:pt-0 sm:px-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>برآورد هزینه ({ov.current_month_label})</span>
              <Coins className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
              {formatToman(ov.current_month_spend_toman)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              مجموع کل: {formatToman(ov.total_spend_toman)} · {toPersianDigits(ov.current_month_pages)} صفحه این ماه
            </div>
          </div>

          <div className="pt-4 lg:pt-0 sm:pr-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>موجودی کیف پول فراز اس‌ام‌اس</span>
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
              {loadingProvider
                ? '...'
                : provider?.balance_toman !== null && provider?.balance_toman !== undefined
                ? formatToman(provider.balance_toman)
                : 'نامشخص'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {estimatedRemainingPages !== null
                ? `حدود ${toPersianDigits(estimatedRemainingPages.toLocaleString('en-US'))} صفحه پیامک باقی‌مانده`
                : 'استعلام زنده از وب‌سرویس'}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Compact Tariff Control & Actions Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5">
            <div className="font-extrabold text-slate-900 dark:text-white">
              مبنای محاسبه هزینه ماهانه (تعرفه هر صفحه پیامک فارسی)
            </div>
            <div className="text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 tabular-nums">
              <span>
                تعرفه مؤثر فعلی:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {formatToman(ov.effective_unit_cost_toman)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                منبع:{' '}
                {ov.tariff_source === 'manual'
                  ? 'تعرفه دستی ثبت‌شده توسط مدیر'
                  : ov.tariff_source === 'auto'
                  ? 'محاسبه خودکار از وب‌سرویس فراز اس‌ام‌اس'
                  : 'تعرفه پایه پیش‌فرض'}
              </span>
              {ov.auto_unit_cost_toman && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>تعرفه زنده پنل: {formatToman(ov.auto_unit_cost_toman)}</span>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleTariffSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={50000}
              step={1}
              dir="ltr"
              value={tariffInput}
              onChange={(e) => setTariffInput(e.target.value)}
              placeholder={`خودکار (${ov.auto_unit_cost_toman || 197})`}
              className="w-36 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono text-left tabular-nums focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingTariff}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingTariff ? 'در حال ذخیره...' : 'ذخیره تعرفه'}</span>
            </button>
            {ov.tariff_source === 'manual' && (
              <button
                type="button"
                disabled={savingTariff}
                onClick={handleResetAutoTariff}
                className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازگشت به خودکار</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loadingAnalytics}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              <span>بروزرسانی</span>
            </button>
          </form>
        </div>

        {tariffFeedback && (
          <div
            className={`rounded-lg border px-3.5 py-2 text-xs font-bold flex items-center gap-2 ${
              tariffFeedback.type === 'success'
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
          >
            {tariffFeedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{tariffFeedback.text}</span>
          </div>
        )}
      </section>

      {/* Empty State Callout when Zero SMS Logs Exist */}
      {ov.total === 0 && (
        <section className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              هنوز هیچ پیامکی در تاریخچه سامانه ثبت نشده است
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              با ارسال اولین پیامک آزمایشی از آزمایشگاه تست یا ثبت‌نام متقاضیان، نمودارهای روند ماهانه، نرخ تحویل و هزینه به صورت زنده پر می‌شوند.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('TEST')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ارسال اولین پیامک آزمایشی</span>
          </button>
        </section>
      )}

      {/* 3. Analytical Charts Row 1: Monthly Volume & Spend (8 cols) + Delivery Rate Donut (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>روند ماهانه حجم ارسال و هزینه پیامک (تومان)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                مقایسه تعداد پیامک‌های موفق/ناموفق در کنار برآورد هزینه تومانی هر ماه شمسی
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                موفق
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                ناموفق
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-blue-600 inline-block" />
                هزینه (تومان)
              </span>
            </div>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                <XAxis
                  dataKey="month_label"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  orientation="left"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <YAxis
                  yAxisId="spend"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#2563EB' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    direction: 'rtl',
                    textAlign: 'right',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = Number(value || 0);
                    const label = String(name || '');
                    if (label === 'هزینه ماهانه') {
                      return [formatToman(num), label];
                    }
                    return [`${toPersianDigits(num)} پیامک`, label];
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="sent"
                  name="ارسال موفق"
                  fill="#16A34A"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="count"
                  dataKey="failed"
                  name="ناموفق"
                  fill="#DC2626"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="spend"
                  type="monotone"
                  dataKey="spend_toman"
                  name="هزینه ماهانه"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563EB' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: Delivery Status Breakdown Donut */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              نرخ موفقیت و وضعیت تحویل
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              نسبت پیامک‌های تحویل‌شده به وب‌سرویس در برابر خطاها
            </p>
          </div>

          <div className="relative h-48 w-full flex items-center justify-center" dir="ltr">
            {deliveryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deliveryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={76}
                    paddingAngle={2}
                  >
                    {deliveryPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${toPersianDigits(Number(value || 0))} پیامک`,
                      String(name || ''),
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                      direction: 'rtl',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-36 h-36 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center" />
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {toPersianDigits(ov.delivery_rate)}٪
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">نرخ موفقیت</div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                ارسال موفق
              </span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {toPersianDigits(ov.sent)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                ارسال ناموفق
              </span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {toPersianDigits(ov.failed)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                ردشده (رویداد غیرفعال)
              </span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {toPersianDigits(ov.skipped)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Analytical Charts Row 2: Volume by Event (7 cols) + Send Mode Breakdown & Quick Shortcuts (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                توزیع پیامک‌ها بر اساس نوع رویداد
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                سهم کد تایید (OTP)، ثبت‌نام موفق، دعوت به مصاحبه، قالب‌های سفارشی و تست
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('LOGS')}
              className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>مشاهده جدول لاگ‌ها</span>
              <ArrowUpLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {byEvent.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              داده‌ای برای تفکیک رویدادها هنوز ثبت نشده است.
            </div>
          ) : (
            <div className="h-56 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byEvent.slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={130}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                      direction: 'rtl',
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `${toPersianDigits(Number(value || 0))} پیامک`,
                      String(name || ''),
                    ]}
                  />
                  <Bar dataKey="sent" name="موفق" stackId="a" fill="#2563EB" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  <Bar dataKey="failed" name="ناموفق" stackId="a" fill="#DC2626" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Channel Split (Pattern vs Plain Text) & Operational Shortcuts */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                سهم روش‌های ارسال (پترن سریع در برابر متن دلخواه)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                ارسال با پترن از بلک‌لیست مخابراتی عبور کرده و سرعت تحویل بالاتری دارد
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {byMode.map((m) => {
                const share = ov.total > 0 ? Math.round((m.total / ov.total) * 100) : 0;
                const isPattern = m.mode === 'pattern';
                return (
                  <div key={m.mode} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{m.label}</span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {toPersianDigits(m.total)} پیامک ({toPersianDigits(share)}٪)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isPattern ? 'bg-blue-600' : 'bg-slate-500'
                        }`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {toPersianDigits(m.sent)} موفق · {toPersianDigits(m.failed)} ناموفق
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('TEST')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>آزمایشگاه تست ارسال</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('TEMPLATES')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>مدیریت قالب‌ها و پترن‌ها</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

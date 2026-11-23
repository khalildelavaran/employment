import React, { useState } from 'react';
import {
  Users,
  FilePlus,
  Search,
  UserCheck,
  Calendar,
  CheckCircle2,
  Briefcase,
  XCircle,
  Filter,
  Printer,
  GitCompare,
  Eye,
  SlidersHorizontal,
  FileText,
  ArrowUpDown,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LIST,
  ApplicantSummaryRow,
  DEGREE_LEVELS,
  IN_PERSON_DOCS_STATUSES,
  MILITARY_STATUS_OPTIONS,
} from '../types/recruitment.ts';
import { formatToman, toPersianDigits } from '../utils/validation.ts';
export { AnalyticsDashboardView } from './AnalyticsDashboardView.tsx';

// ============================================================================
// MODULE 5: OVERVIEW DASHBOARD (9 KPI CARDS + 7 CHARTS)
// ============================================================================

export interface DashboardData {
  cards: {
    total_applicants: number;
    new_applications: number;
    under_review: number;
    initial_qualified: number;
    invited_to_interview: number;
    interview_completed: number;
    approved: number;
    hired: number;
    rejected: number;
  };
  charts: {
    genderDistribution: Array<{ label: string; count: number }>;
    ageBuckets: Array<{ label: string; count: number }>;
    degreeDistribution: Array<{ label: string; count: number }>;
    acquaintanceDistribution: Array<{ label: string; count: number }>;
    workflowPipeline: Array<{ code: string; title: string; color_variant: string; count: number }>;
    salaryComparison: Array<{ name: string; national_code: string; proposed_salary_toman: number; avg_score: number }>;
    registrationsTimeline: Array<{ date: string; count: number }>;
    conversionFunnel?: Array<{
      stage: string;
      count: number;
      conversionRate: number;
      stepRetentionRate: number;
    }>;
    sourceEffectiveness?: Array<{
      source: string;
      totalCount: number;
      qualifiedCount: number;
      approvedOrHiredCount: number;
      conversionRate: number;
      hireRate: number;
      avgScore: number;
    }>;
    bottlenecksOverTime?: Array<{
      date: string;
      totalRegistered: number;
      waitingReviewBottleneck: number;
      waitingInterviewBottleneck: number;
      finalizedCount: number;
      avgDaysToDecision?: number;
    }>;
    timeToHireMetrics?: Array<{
      stage: string;
      avgDays: number;
      targetDays: number;
      activeCount: number;
    }>;
    avgTimeToHireDays?: number;
  };
}

export const DashboardAnalyticsView: React.FC<{
  stats: DashboardData | null;
  onNavigateStatusFilter: (statusCode: string) => void;
}> = ({ stats, onNavigateStatusFilter }) => {
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');

  if (!stats) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        در حال بارگذاری آمار و اطلاعات...
      </div>
    );
  }

  const kpiCards = [
    { label: 'تعداد کل متقاضیان', value: stats.cards.total_applicants, icon: Users, color: 'text-blue-600', statusFilter: 'ALL' },
    { label: 'درخواست‌های جدید', value: stats.cards.new_applications, icon: FilePlus, color: 'text-indigo-600', statusFilter: 'NEW_APPLICATION' },
    { label: 'درخواست‌های در حال بررسی', value: stats.cards.under_review, icon: Clock, color: 'text-amber-600', statusFilter: 'RESUME_REVIEWING' },
    { label: 'واجد شرایط اولیه', value: stats.cards.initial_qualified, icon: UserCheck, color: 'text-blue-600', statusFilter: 'INITIAL_QUALIFIED' },
    { label: 'دعوت‌شدگان به مصاحبه', value: stats.cards.invited_to_interview, icon: Calendar, color: 'text-purple-600', statusFilter: 'INVITED_TO_INTERVIEW' },
    { label: 'مصاحبه‌شده‌ها', value: stats.cards.interview_completed, icon: FileText, color: 'text-indigo-600', statusFilter: 'INTERVIEW_COMPLETED' },
    { label: 'تأییدشدگان نهایی', value: stats.cards.approved, icon: CheckCircle2, color: 'text-emerald-600', statusFilter: 'FINAL_APPROVED' },
    { label: 'افراد استخدام‌شده', value: stats.cards.hired, icon: Briefcase, color: 'text-emerald-700', statusFilter: 'HIRED' },
    { label: 'درخواست‌های ردشده / انصراف', value: stats.cards.rejected, icon: XCircle, color: 'text-rose-600', statusFilter: 'REJECTED' },
  ];

  const maxSalary = Math.max(...stats.charts.salaryComparison.map((s) => s.proposed_salary_toman), 15000000);
  const totalGender = Math.max(1, stats.charts.genderDistribution.reduce((acc, g) => acc + g.count, 0));

  return (
    <div className="space-y-6">
      {/* Date Range Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            داشبورد مدیریتی جذب و استخدام شرکت دستوا
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          {[
            { id: 'ALL', label: 'کل دوره جذب ۱۴۰۵' },
            { id: 'MONTH', label: 'آبان ۱۴۰۵' },
            { id: 'WEEK', label: 'هفته جاری' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setDateRangeFilter(b.id as typeof dateRangeFilter)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                dateRangeFilter === b.id
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 9 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card, idx) => {
          const IconComp = card.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onNavigateStatusFilter(card.statusFilter)}
              className="text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-blue-500 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  {card.label}
                </span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {toPersianDigits(card.value)}
                </span>
                <span className="text-[11px] text-slate-400 mr-1.5">پرونده</span>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${card.color}`}>
                <IconComp className="w-5 h-5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 7 Analytical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Workflow Status Pipeline (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            ۱. نمودار وضعیت گردش کار استخدام (۱۲ مرحله استاندارد)
          </h3>
          <div className="space-y-2.5">
            {stats.charts.workflowPipeline.map((st) => {
              const pct = Math.round((st.count / Math.max(1, stats.cards.total_applicants)) * 100);
              return (
                <div key={st.code} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{st.title}</span>
                    <span className="font-bold tabular-nums">
                      {toPersianDigits(st.count)} نفر ({toPersianDigits(pct)}٪)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(st.count > 0 ? 8 : 0, pct)}%`,
                        backgroundColor: 'var(--theme-chart-1)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2 & 3: Gender & Age Distribution (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              ۲. توزیع متقاضیان بر اساس جنسیت
            </h3>
            <div className="space-y-3">
              {stats.charts.genderDistribution.map((g) => {
                const pct = Math.round((g.count / totalGender) * 100);
                return (
                  <div key={g.label} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{g.label}</span>
                      <span className="font-bold tabular-nums">
                        {toPersianDigits(g.count)} نفر ({toPersianDigits(pct)}٪)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: g.label === 'بانوان' ? 'var(--theme-chart-2)' : 'var(--theme-chart-1)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              ۳. توزیع سنی متقاضیان
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {stats.charts.ageBuckets.map((b) => (
                <div
                  key={b.label}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                >
                  <div className="text-slate-500">{b.label}</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                    {toPersianDigits(b.count)} <span className="text-xs font-normal text-slate-400">نفر</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4 & 5: Degree Distribution & Acquaintance Source */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            ۴. توزیع مقاطع تحصیلی و ۵. نحوه آشنایی با استخدام دستوا
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-500 mb-2">مقاطع تحصیلی:</div>
              {stats.charts.degreeDistribution.map((d) => (
                <div key={d.label} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>{d.label}</span>
                  <span className="font-bold tabular-nums">{toPersianDigits(d.count)} نفر</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-500 mb-2">طریق آشنایی:</div>
              {stats.charts.acquaintanceDistribution.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="truncate max-w-[160px]" title={s.label}>{s.label}</span>
                  <span className="font-bold tabular-nums">{toPersianDigits(s.count)} نفر</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 6 & 7: Proposed Salary Comparison & Registration Trend */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            ۶. مقایسه حقوق پیشنهادی متقاضیان (تومان) و ۷. روند ثبت‌نام روزانه
          </h3>
          <div className="space-y-3 text-xs">
            {stats.charts.salaryComparison.map((item) => {
              const barPct = Math.round((item.proposed_salary_toman / maxSalary) * 100);
              return (
                <div key={item.national_code}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {formatToman(item.proposed_salary_toman)} تومان
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barPct}%`, backgroundColor: 'var(--theme-chart-3)' }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
              <span>روند ثبت‌نام بر اساس تاریخ:</span>
              {stats.charts.registrationsTimeline.map((rt) => (
                <span key={rt.date} className="font-semibold text-slate-700 dark:text-slate-300">
                  {toPersianDigits(rt.date)}: {toPersianDigits(rt.count)} ثبت‌نام
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODULE 6: APPLICANTS MANAGEMENT TABLE, COMBINED FILTERS & EXCEL EXPORT
// ============================================================================

interface ApplicantsTableViewProps {
  items: ApplicantSummaryRow[];
  total: number;
  filters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  onOpenDossier: (applicationId: number) => void;
  onCompareSelected: () => void;
  onBatchPrintSelected: () => void;
  onPrintTableReport: () => void;
  onBulkStatusUpdated?: () => void;
}

export const ApplicantsTableView: React.FC<ApplicantsTableViewProps> = ({
  items,
  total,
  filters,
  setFilters,
  selectedIds,
  setSelectedIds,
  onOpenDossier,
  onCompareSelected,
  onBatchPrintSelected,
  onPrintTableReport,
  onBulkStatusUpdated,
}) => {
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<string>('INVITED_TO_INTERVIEW');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
  const [bulkToast, setBulkToast] = useState<string>('');

  const [visibleCols, setVisibleCols] = useState({
    full_name: true,
    national_code: true,
    mobile: true,
    gender: true,
    calculated_age: true,
    marital_status: true,
    primary_major: true,
    primary_degree: true,
    submitted_at_jalali: true,
    status_title: true,
    in_person_docs_status: true,
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.application_id));
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortDir: prev.sortBy === column && prev.sortDir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleBulkStatusChange = async (statusCode: string, customReason?: string) => {
    if (selectedIds.length === 0 || isBulkUpdating) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/admin/applicants/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: selectedIds,
          new_status_code: statusCode,
          reason: customReason ?? bulkReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const statusTitle =
          APPLICATION_STATUS_LIST.find((s) => s.code === statusCode)?.title || statusCode;
        setBulkToast(
          `وضعیت ${toPersianDigits(data.updated_count)} پرونده انتخاب‌شده با موفقیت به «${statusTitle}» تغییر یافت.`
        );
        setTimeout(() => setBulkToast(''), 4000);
        setBulkReason('');
        setSelectedIds([]);
        if (onBulkStatusUpdated) {
          onBulkStatusUpdated();
        }
      }
    } finally {
      setIsBulkUpdating(false);
    }
  };


const handleExportToExcel = async () => {
  const ExcelJS = await import('exceljs');

  const targetList =
    selectedIds.length > 0
      ? items.filter((item) =>
          selectedIds.includes(item.application_id)
        )
      : items;

  const rowsToExport = targetList.map((row, index) => ({
    'ردیف': index + 1,
    'نام و نام خانوادگی': row.full_name,
    'کد ملی': row.national_code,
    'شماره موبایل': row.mobile,
    'جنسیت': row.gender,
    'تاریخ تولد': row.birth_date_jalali,
    'سن (سال)': row.calculated_age,
    'وضعیت شرایط سنی': row.is_age_qualified
      ? 'واجد شرایط'
      : row.age_warning_text || 'خارج از محدوده',
    'وضعیت تأهل': row.marital_status,
    'وضعیت نظام وظیفه': row.military_status || '—',
    'مقطع تحصیلی': row.primary_degree,
    'رشته تحصیلی': row.primary_major,
    'دانشگاه محل تحصیل': row.primary_university,
    'شهر محل سکونت': row.city,
    'منطقه / محله': row.district,
    'سابقه کار (ماه)': row.total_experience_months,
    'حقوق پیشنهادی (تومان)': row.proposed_salary_toman,
    'نحوه آشنایی': row.acquaintance_source,
    'وضعیت فعلی استخدام': row.status_title,
    'وضعیت مدارک حضوری': row.in_person_docs_status,
    'امتیاز ارزیابی / مصاحبه':
      row.avg_evaluation_score || row.avg_interview_score || 0,
    'تاریخ ثبت درخواست': row.submitted_at_jalali,
  }));

  const headers = [
    'ردیف',
    'نام و نام خانوادگی',
    'کد ملی',
    'شماره موبایل',
    'جنسیت',
    'تاریخ تولد',
    'سن (سال)',
    'وضعیت شرایط سنی',
    'وضعیت تأهل',
    'وضعیت نظام وظیفه',
    'مقطع تحصیلی',
    'رشته تحصیلی',
    'دانشگاه محل تحصیل',
    'شهر محل سکونت',
    'منطقه / محله',
    'سابقه کار (ماه)',
    'حقوق پیشنهادی (تومان)',
    'نحوه آشنایی',
    'وضعیت فعلی استخدام',
    'وضعیت مدارک حضوری',
    'امتیاز ارزیابی / مصاحبه',
    'تاریخ ثبت درخواست',
  ];

  const columnWidths = [
    6, 22, 14, 15, 10, 13, 10, 24, 12, 18, 16,
    22, 22, 15, 18, 14, 20, 18, 22, 18, 18, 20,
  ];

  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet('متقاضیان استخدام', {
    views: [{ rightToLeft: true }],
  });

  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `column_${index}`,
    width: columnWidths[index],
  }));

  rowsToExport.forEach((row) => {
    worksheet.addRow(headers.map((header) => row[header as keyof typeof row] ?? ''));
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `dasteva_applicants_export_${Date.now()}.xlsx`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

  return (
    <div className="space-y-4">
      {bulkToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bulkToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setBulkToast('')}
            className="text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Bulk Status Update & Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50/70 dark:bg-slate-900 border-2 border-blue-500 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>
                عملیات و تغییر وضعیت گروهی برای{' '}
                <strong className="text-blue-600 underline tabular-nums">
                  {toPersianDigits(selectedIds.length)}
                </strong>{' '}
                متقاضی انتخاب‌شده:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() =>
                  handleBulkStatusChange('INVITED_TO_INTERVIEW', 'دعوت گروهی به مصاحبه از جدول متقاضیان')
                }
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>انتقال به مصاحبه (Move to Interview)</span>
              </button>

              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() =>
                  handleBulkStatusChange('INITIAL_QUALIFIED', 'تأیید شرایط اولیه گروهی از جدول متقاضیان')
                }
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>واجد شرایط اولیه</span>
              </button>

              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() =>
                  handleBulkStatusChange('FINAL_APPROVED', 'تأیید نهایی گروهی از جدول متقاضیان')
                }
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تأیید نهایی</span>
              </button>

              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() =>
                  handleBulkStatusChange('REJECTED', 'رد درخواست گروهی از جدول متقاضیان')
                }
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>رد درخواست (Reject)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                لغو انتخاب
              </button>
            </div>
          </div>

          {/* Custom Stage Selector + Reason Input */}
          <div className="pt-3 border-t border-blue-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              انتخاب مرحله دلخواه (۱۲ مرحله):
            </span>
            <select
              value={bulkStatusTarget}
              onChange={(e) => setBulkStatusTarget(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-semibold"
            >
              {APPLICATION_STATUS_LIST.map((st) => (
                <option key={st.code} value={st.code}>
                  {toPersianDigits(st.step_order)}. {st.title}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="علت یا توضیح تغییر وضعیت گروهی (اختیاری)..."
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5"
            />

            <button
              type="button"
              disabled={isBulkUpdating}
              onClick={() => handleBulkStatusChange(bulkStatusTarget)}
              className="rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              {isBulkUpdating ? 'در حال اعمال...' : 'اعمال تغییر وضعیت گروهی'}
            </button>
          </div>
        </div>
      )}

      {/* Top Action & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: '1' }))}
              placeholder="جستجو بر اساس نام، نام خانوادگی، کد ملی، شماره موبایل یا رشته تحصیلی..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-4 py-2 text-xs sm:text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>فیلترهای پیشرفته ترکیبی</span>
            </button>

            <button
              type="button"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ستون‌ها</span>
            </button>

            <button
              type="button"
              onClick={handleExportToExcel}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                خروجی اکسل (Excel) (
                {toPersianDigits(selectedIds.length > 0 ? selectedIds.length : items.length)})
              </span>
            </button>

            <button
              type="button"
              onClick={onPrintTableReport}
              className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>خروجی PDF جدول ({toPersianDigits(total)})</span>
            </button>

            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={onCompareSelected}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>مقایسه انتخاب‌شده‌ها ({toPersianDigits(selectedIds.length)})</span>
                </button>
                <button
                  type="button"
                  onClick={onBatchPrintSelected}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ گروهی پرونده‌ها ({toPersianDigits(selectedIds.length)})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Column Visibility Picker */}
        {showColumnPicker && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-500">انتخاب ستون‌های قابل نمایش:</span>
            {Object.entries({
              full_name: 'نام و نام خانوادگی',
              national_code: 'کد ملی',
              mobile: 'موبایل',
              gender: 'جنسیت',
              calculated_age: 'سن',
              marital_status: 'وضعیت تأهل',
              primary_major: 'رشته تحصیلی',
              primary_degree: 'مقطع تحصیلی',
              submitted_at_jalali: 'تاریخ ثبت',
              status_title: 'وضعیت استخدام',
              in_person_docs_status: 'مدارک حضوری',
            }).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleCols[key as keyof typeof visibleCols]}
                  onChange={(e) =>
                    setVisibleCols((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        {/* Combined Multi-Criteria Filter Grid */}
        {showFilterPanel && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">جنسیت</label>
              <select
                value={filters.gender || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, gender: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه</option>
                <option value="زن">زن</option>
                <option value="مرد">مرد</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">محدوده سنی (حداقل - حداکثر)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="از"
                  value={filters.minAge || ''}
                  onChange={(e) => setFilters((p) => ({ ...p, minAge: e.target.value, page: '1' }))}
                  className="w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 tabular-nums"
                />
                <input
                  type="number"
                  placeholder="تا"
                  value={filters.maxAge || ''}
                  onChange={(e) => setFilters((p) => ({ ...p, maxAge: e.target.value, page: '1' }))}
                  className="w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">وضعیت تأهل</label>
              <select
                value={filters.maritalStatus || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, maritalStatus: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه</option>
                <option value="مجرد">مجرد</option>
                <option value="متأهل">متأهل</option>
                <option value="مطلقه">مطلقه</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">مقطع تحصیلی</label>
              <select
                value={filters.degreeLevel || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, degreeLevel: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه مقاطع</option>
                {DEGREE_LEVELS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">سابقه شغلی</label>
              <select
                value={filters.hasWorkExperience || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, hasWorkExperience: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه</option>
                <option value="1">دارای سابقه کار</option>
                <option value="0">بدون سابقه کار</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">شرایط سنی مصوب</label>
              <select
                value={filters.ageQualification || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, ageQualification: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه متقاضیان</option>
                <option value="QUALIFIED">واجد شرایط سنی</option>
                <option value="OUT_OF_RANGE">خارج از محدوده سنی</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">وضعیت استخدام (۱۲ مرحله)</label>
              <select
                value={filters.statusCode || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, statusCode: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه وضعیت‌ها</option>
                {APPLICATION_STATUS_LIST.map((st) => (
                  <option key={st.code} value={st.code}>{st.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">وضعیت مدارک حضوری</label>
              <select
                value={filters.inPersonDocsStatus || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, inPersonDocsStatus: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه</option>
                {IN_PERSON_DOCS_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">وضعیت نظام وظیفه</label>
              <select
                value={filters.militaryStatus || 'ALL'}
                onChange={(e) => setFilters((p) => ({ ...p, militaryStatus: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه</option>
                {MILITARY_STATUS_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 mb-1">شهرستان محل سکونت</label>
              <input
                type="text"
                placeholder="مثال: شوشتر"
                value={filters.city === 'ALL' ? '' : filters.city || ''}
                onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value, page: '1' }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: '',
                    gender: 'ALL',
                    minAge: '',
                    maxAge: '',
                    maritalStatus: 'ALL',
                    degreeLevel: 'ALL',
                    city: '',
                    hasWorkExperience: 'ALL',
                    militaryStatus: 'ALL',
                    statusCode: 'ALL',
                    ageQualification: 'ALL',
                    inPersonDocsStatus: 'ALL',
                    sortBy: 'application_id',
                    sortDir: 'desc',
                    page: '1',
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                پاک‌سازی همه فیلترها
              </button>
            </div>
          </div>
        )}
      </div>

      {/* High-Density Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            تعداد نتایج یافت‌شده: <strong className="text-slate-900 dark:text-white tabular-nums">{toPersianDigits(total)}</strong> متقاضی
          </span>
          <span>برای مرتب‌سازی روی عنوان ستون‌ها کلیک کنید</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3 px-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="py-3 px-2">ردیف</th>
                {visibleCols.full_name && (
                  <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('last_name')}>
                    <span className="inline-flex items-center gap-1">نام و نام خانوادگی <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                )}
                {visibleCols.national_code && <th className="py-3 px-3">کد ملی</th>}
                {visibleCols.mobile && <th className="py-3 px-3">شماره موبایل</th>}
                {visibleCols.gender && <th className="py-3 px-2">جنسیت</th>}
                {visibleCols.calculated_age && (
                  <th className="py-3 px-2 cursor-pointer" onClick={() => handleSort('calculated_age')}>
                    <span className="inline-flex items-center gap-1">سن <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                )}
                {visibleCols.marital_status && <th className="py-3 px-2">تأهل</th>}
                {visibleCols.primary_major && <th className="py-3 px-3">رشته تحصیلی</th>}
                {visibleCols.primary_degree && <th className="py-3 px-2">مقطع</th>}
                {visibleCols.submitted_at_jalali && <th className="py-3 px-3">تاریخ ثبت</th>}
                {visibleCols.status_title && <th className="py-3 px-3">وضعیت استخدام</th>}
                {visibleCols.in_person_docs_status && <th className="py-3 px-3">مدارک حضوری</th>}
                <th className="py-3 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((row, idx) => (
                <tr
                  key={row.application_id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.application_id)}
                      onChange={() => toggleSelectOne(row.application_id)}
                    />
                  </td>
                  <td className="py-2.5 px-2 tabular-nums text-slate-400">{toPersianDigits(idx + 1)}</td>
                  {visibleCols.full_name && (
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {row.full_name}
                      {!row.is_age_qualified && (
                        <span
                          title={row.age_warning_text}
                          className="block text-[10px] font-normal text-amber-600 dark:text-amber-400"
                        >
                          هشدار شرایط سنی
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.national_code && (
                    <td className="py-2.5 px-3 tabular-nums">{toPersianDigits(row.national_code)}</td>
                  )}
                  {visibleCols.mobile && (
                    <td className="py-2.5 px-3 tabular-nums">{toPersianDigits(row.mobile)}</td>
                  )}
                  {visibleCols.gender && <td className="py-2.5 px-2">{row.gender}</td>}
                  {visibleCols.calculated_age && (
                    <td className="py-2.5 px-2 tabular-nums font-semibold">
                      <span className={!row.is_age_qualified ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {toPersianDigits(row.calculated_age)}
                      </span>
                    </td>
                  )}
                  {visibleCols.marital_status && <td className="py-2.5 px-2">{row.marital_status}</td>}
                  {visibleCols.primary_major && <td className="py-2.5 px-3">{row.primary_major}</td>}
                  {visibleCols.primary_degree && <td className="py-2.5 px-2 font-medium">{row.primary_degree}</td>}
                  {visibleCols.submitted_at_jalali && (
                    <td className="py-2.5 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                      {toPersianDigits(row.submitted_at_jalali)}
                    </td>
                  )}
                  {visibleCols.status_title && (
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.status_title}
                    </td>
                  )}
                  {visibleCols.in_person_docs_status && (
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {row.in_person_docs_status}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-left whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenDossier(row.application_id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>پرونده کامل</span>
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-10 text-center text-slate-500">
                    هیچ پرونده متقاضی منطبق با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODULE 9: VISUAL WORKFLOW PIPELINE (12 STAGES)
// ============================================================================

export const WorkflowPipelineView: React.FC<{
  items: ApplicantSummaryRow[];
  onOpenDossier: (applicationId: number) => void;
}> = ({ items, onOpenDossier }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
          مدیریت مراحل و گردش کار استخدام (Pipeline ۱۲ مرحله‌ای)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          نمای کلی تعداد و فهرست متقاضیان حاضر در هر یک از ۱۲ مرحله استاندارد استخدام شرکت دستوا. برای تغییر وضعیت یا ثبت دلیل روی پرونده متقاضی کلیک کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {APPLICATION_STATUS_LIST.map((stage) => {
          const stageApplicants = items.filter((a) => a.status_code === stage.code);
          return (
            <div
              key={stage.code}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {toPersianDigits(stage.step_order)}. {stage.title}
                  </span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {toPersianDigits(stageApplicants.length)} نفر
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {stageApplicants.map((app) => (
                    <button
                      key={app.application_id}
                      type="button"
                      onClick={() => onOpenDossier(app.application_id)}
                      className="w-full text-right p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors text-xs space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{app.full_name}</span>
                        <span className="text-slate-400 tabular-nums text-[11px]">{toPersianDigits(app.national_code)}</span>
                      </div>
                      <div className="text-slate-500 flex items-center justify-between tabular-nums text-[11px]">
                        <span>{app.primary_degree} {app.primary_major}</span>
                        <span>{formatToman(app.proposed_salary_toman)} ت</span>
                      </div>
                    </button>
                  ))}
                  {stageApplicants.length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">بدون متقاضی در این مرحله</p>
                  )}
                </div>
              </div>f
            </div>
          );
        })}
      </div>
    </div>
  );
};

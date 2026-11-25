import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Printer,
  Calendar as CalendarIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Database,
  Download,
  Sliders,
  Clock,
  Palette,
  MessageSquare,
  Upload,
  Trash2,
  Lock,
  RotateCcw,
} from 'lucide-react';
import {
  ApplicantFullDossier,
  ApplicantSummaryRow,
  DEFAULT_ENABLED_REGISTRATION_STEPS,
  EvaluationCriterion,
  InterviewRecord,
  REGISTRATION_STEPS_META,
  RecruitmentSettings,
  normalizeEnabledRegistrationSteps,
} from '../types/recruitment.ts';
import { ThemePresetId, ThemeTokens } from '../theme/presets.ts';
import { ThemeGalleryView } from './ThemeGalleryView.tsx';
import { SmsSettingsView } from './SmsSettingsView.tsx';
import { DastevaLogoMark } from './DastevaLogoMark.tsx';
import { formatToman, toPersianDigits } from '../utils/validation.ts';

// ============================================================================
// MODULE 10: APPLICANT COMPARISON & WEIGHTED SCORING CONFIGURATOR
// ============================================================================

export const ComparisonModuleView: React.FC<{
  allApplicants: ApplicantSummaryRow[];
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  onPrintComparison: (dossiers: ApplicantFullDossier[]) => void;
  onOpenDossier: (applicationId: number) => void;
}> = ({
  allApplicants,
  selectedIds,
  setSelectedIds,
  onPrintComparison,
  onOpenDossier,
}) => {
  const [comparedDossiers, setComparedDossiers] = useState<ApplicantFullDossier[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [sortByScore, setSortByScore] = useState(true);
  const [showWeightsEditor, setShowWeightsEditor] = useState(false);
  const [toast, setToast] = useState('');

  const headers = {
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    const idsToLoad =
      selectedIds.length >= 2
        ? selectedIds
        : allApplicants.slice(0, 3).map((a) => a.application_id);

    fetch('/api/admin/applicants/batch-dossiers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ application_ids: idsToLoad }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.dossiers) {
          setComparedDossiers(data.dossiers);
        }
      });

    fetch('/api/admin/evaluations/criteria', { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.criteria) setCriteria(data.criteria);
      });
  }, [selectedIds, allApplicants]);

  const sortedDossiers = [...comparedDossiers].sort((a, b) => {
    if (!sortByScore) return 0;
    const sa = a.avg_evaluation_score || a.avg_interview_score;
    const sb = b.avg_evaluation_score || b.avg_interview_score;
    return sb - sa;
  });

  const handleSaveWeights = async () => {
    const res = await fetch('/api/admin/evaluations/criteria', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ criteria }),
    });
    if (res.ok) {
      setToast('وزن معیارهای امتیازدهی با موفقیت به‌روزرسانی شد.');
      setTimeout(() => setToast(''), 3000);
      setShowWeightsEditor(false);
    }
  };

  const toggleCandidateInComparison = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <span>ماژول مقایسه تحلیلی متقاضیان استخدام</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              امتیاز نهایی صرفاً ابزار کمکی تصمیم‌گیری است و جایگزین ارزیابی انسانی نمی‌شود. ویژگی‌های غیرمرتبط با شغل مبنای رتبه‌بندی قرار نمی‌گیرند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSortByScore(!sortByScore)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              {sortByScore ? 'مرتب‌شده بر اساس بالاترین امتیاز' : 'مرتب‌سازی بر اساس امتیاز'}
            </button>
            <button
              type="button"
              onClick={() => setShowWeightsEditor(!showWeightsEditor)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>تنظیم وزن معیارهای امتیازدهی</span>
            </button>
            <button
              type="button"
              onClick={() => onPrintComparison(sortedDossiers)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>دریافت گزارش مقایسه PDF / چاپ</span>
            </button>
          </div>
        </div>

        {toast && <p className="text-xs font-bold text-emerald-600">{toast}</p>}

        {/* Candidate Selector Strip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 block mb-2">
            انتخاب متقاضیان جهت مقایسه کنار یکدیگر:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {allApplicants.map((app) => {
              const isSelected = sortedDossiers.some((d) => d.application_id === app.application_id);
              return (
                <button
                  key={app.application_id}
                  type="button"
                  onClick={() => toggleCandidateInComparison(app.application_id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {app.full_name} ({toPersianDigits(app.avg_evaluation_score || app.avg_interview_score)})
                </button>
              );
            })}
          </div>
        </div>

        {/* Configurable Scoring Weights Panel */}
        {showWeightsEditor && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold">تنظیم وزن معیارهای ۸ گانه ارزیابی (توسط مدیر سامانه)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {criteria.map((c, idx) => (
                <div key={c.id} className="p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <div className="font-semibold mb-1">{c.title}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">وزن:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={c.weight}
                      onChange={(e) => {
                        const copy = [...criteria];
                        copy[idx] = { ...copy[idx], weight: Number(e.target.value) };
                        setCriteria(copy);
                      }}
                      className="w-16 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-center font-bold tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSaveWeights}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              ذخیره وزن‌های امتیازدهی
            </button>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <th className="p-4 font-bold text-slate-600 dark:text-slate-300 min-w-[170px]">شاخص مقایسه</th>
              {sortedDossiers.map((d) => (
                <th key={d.application_id} className="p-4 min-w-[220px]">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">{d.full_name}</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">کد ملی: {toPersianDigits(d.national_code)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۱. سن و تطابق با شرایط سنی</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 tabular-nums">
                  <span className="font-bold">{toPersianDigits(d.calculated_age)} سال</span> ({d.gender})
                  {!d.is_age_qualified && (
                    <span className="block text-[11px] text-amber-600 mt-0.5">{d.age_warning_text}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۲. مقطع و رشته تحصیلی</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5">
                  <strong>{d.primary_degree}</strong> — {d.primary_major}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۳. دانشگاه محل تحصیل</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5">{d.primary_university}</td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۴. شهرستان محل سکونت</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5">{d.city} ({d.district})</td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۵. سابقه شغلی و تجربه مرتبط</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 tabular-nums">
                  {d.total_experience_months > 0 ? (
                    <>
                      <strong>{toPersianDigits(d.total_experience_months)} ماه</strong>
                      <span className="block text-slate-500 mt-0.5">
                        {d.work_experiences[0]?.job_title} ({d.work_experiences[0]?.company_name})
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">فاقد سابقه شغلی</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۶. حقوق پیشنهادی ماهانه</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                  {formatToman(d.proposed_salary_toman)} تومان
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۷. امتیاز مصاحبه (از ۱۰)</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 font-bold tabular-nums">
                  {d.interviews[0]?.overall_score
                    ? `${toPersianDigits(d.interviews[0].overall_score)} از ۱۰`
                    : 'برگزار نشده'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۸. امتیاز ارزیابی وزنی کل (از ۱۰۰)</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 font-extrabold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                  {toPersianDigits(d.avg_evaluation_score || d.avg_interview_score)} / ۱۰۰
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۹. وضعیت فعلی استخدام</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 font-bold">{d.status_title}</td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۱۰. نقاط قوت ثبت‌شده</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  {d.strengths_summary || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">۱۱. نقاط ضعف / ملاحظات</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5 text-amber-700 dark:text-amber-400 leading-relaxed">
                  {d.weaknesses_summary || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3.5 font-bold bg-slate-50/50 dark:bg-slate-800/30">مشاهده پرونده کامل</td>
              {sortedDossiers.map((d) => (
                <td key={d.application_id} className="p-3.5">
                  <button
                    type="button"
                    onClick={() => onOpenDossier(d.application_id)}
                    className="rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    باز کردن پرونده
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MODULE 11: INTERVIEWS MANAGEMENT & RECRUITMENT CALENDAR
// ============================================================================

export const InterviewsCalendarModuleView: React.FC<{
  allApplicants: ApplicantSummaryRow[];
  preselectedApplicantId?: number | null;
  onOpenDossier: (applicationId: number) => void;
  onPrintInterviews: (interviews: InterviewRecord[]) => void;
}> = ({
  allApplicants,
  preselectedApplicantId,
  onOpenDossier,
  onPrintInterviews,
}) => {
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [calendarMode, setCalendarMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // New Interview Form
  const [appId, setAppId] = useState<number>(preselectedApplicantId || (allApplicants[0]?.application_id ?? 1));
  const [stageTitle, setStageTitle] = useState('مصاحبه تخصصی و ارزیابی حضوری');
  const [dateJalali, setDateJalali] = useState('1405/08/25');
  const [timeStr, setTimeStr] = useState('10:00');
  const [locationStr, setLocationStr] = useState('دفتر مرکزی شرکت دستوا');
  const [conflictError, setConflictError] = useState('');
  const [toast, setToast] = useState('');

  const headers = {
    'Content-Type': 'application/json',
  };

  const loadData = async () => {
    const params = new URLSearchParams();
    if (filterDate) params.set('dateJalali', filterDate);
    if (filterStatus !== 'ALL') params.set('status', filterStatus);

    const ivRes = await fetch(`/api/admin/interviews?${params.toString()}`, { headers });
    const ivData = await ivRes.json();
    if (ivData.interviews) setInterviews(ivData.interviews);
  };

  useEffect(() => {
    loadData();
  }, [filterDate, filterStatus]);

  useEffect(() => {
    if (preselectedApplicantId) setAppId(preselectedApplicantId);
  }, [preselectedApplicantId]);

  const handleScheduleInterview = async (forceIgnoreConflict = false) => {
    setConflictError('');
    const res = await fetch('/api/admin/interviews', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        application_id: appId,
        stage_title: stageTitle,
        interview_date_jalali: dateJalali,
        interview_time: timeStr,
        location: locationStr,
        force_ignore_conflict: forceIgnoreConflict,
      }),
    });
    const data = await res.json();
    if (res.status === 409 && data.conflict) {
      setConflictError(data.error);
      return;
    }
    if (res.ok) {
      setToast('جلسه مصاحبه با موفقیت در تقویم استخدام ثبت شد.');
      setTimeout(() => setToast(''), 3000);
      loadData();
    } else if (data.error) {
      setConflictError(data.error);
    }
  };

  const handleUpdateInterviewStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/interviews/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header & View Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span>تقویم استخدام و مدیریت جلسات مصاحبه</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سیستم هوشمند تشخیص تداخل زمانی جلسات مصاحبه و نمایش برنامه روزانه، هفتگی و ماهانه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            {[
              { id: 'DAILY', label: 'نمای روزانه' },
              { id: 'WEEKLY', label: 'نمای هفتگی' },
              { id: 'MONTHLY', label: 'تقویم ماهانه آبان ۱۴۰۵' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCalendarMode(m.id as typeof calendarMode)}
                className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                  calendarMode === m.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onPrintInterviews(interviews)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ فهرست مصاحبه‌ها</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schedule New Interview Form (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold border-b border-slate-100 dark:border-slate-800 pb-2.5 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>تعیین زمان مصاحبه جدید</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">انتخاب متقاضی *</label>
              <select
                value={appId}
                onChange={(e) => setAppId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
              >
                {allApplicants.map((a) => (
                  <option key={a.application_id} value={a.application_id}>
                    {a.full_name} (کد ملی: {toPersianDigits(a.national_code)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">عنوان مرحله مصاحبه *</label>
              <input
                type="text"
                value={stageTitle}
                onChange={(e) => setStageTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">تاریخ شمسی *</label>
                <input
                  type="text"
                  value={dateJalali}
                  onChange={(e) => setDateJalali(e.target.value)}
                  placeholder="1405/08/25"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">ساعت مصاحبه *</label>
                <input
                  type="text"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  placeholder="11:00"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">محل برگزاری *</label>
              <input
                type="text"
                value={locationStr}
                onChange={(e) => setLocationStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
              />
            </div>

            {conflictError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-start gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{conflictError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleScheduleInterview(true)}
                  className="underline font-bold text-amber-900 dark:text-amber-200 cursor-pointer"
                >
                  ثبت با وجود تداخل زمانی (تأیید دستی مدیر سامانه)
                </button>
              </div>
            )}

            {toast && <p className="text-emerald-600 font-bold">{toast}</p>}

            <button
              type="button"
              onClick={() => handleScheduleInterview(false)}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
            >
              ثبت در تقویم مصاحبه
            </button>
          </div>
        </div>

        {/* Calendar & Interviews List (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          {/* Calendar Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">فیلتر تاریخ (شمسی)</label>
              <input
                type="text"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="مثال: 1405/08/25"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1">وضعیت مصاحبه</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
              >
                <option value="ALL">همه جلسات (آینده و انجام‌شده)</option>
                <option value="زمان‌بندی شده">مصاحبه‌های آینده (زمان‌بندی شده)</option>
                <option value="انجام شده">مصاحبه‌های انجام‌شده</option>
                <option value="تغییر زمان یافته">تغییر زمان یافته</option>
                <option value="لغو شده">لغو شده</option>
              </select>
            </div>
          </div>

          {/* Monthly Grid Preview when MONTHLY is active */}
          {calendarMode === 'MONTHLY' && (
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs">
              {Array.from({ length: 14 }, (_, i) => {
                const dayNum = 16 + i;
                const dateStr = `1405/08/${dayNum}`;
                const dayInterviews = interviews.filter((iv) => iv.interview_date_jalali === dateStr);
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setFilterDate(filterDate === dateStr ? '' : dateStr)}
                    className={`p-2 rounded-lg border text-right cursor-pointer ${
                      dayInterviews.length > 0
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="font-bold tabular-nums">{toPersianDigits(dayNum)} آبان</div>
                    <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                      {dayInterviews.length > 0
                        ? `${toPersianDigits(dayInterviews.length)} جلسه مصاحبه`
                        : 'آزاد'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Interviews Cards List */}
          <div className="space-y-3">
            {interviews.map((iv) => (
              <div
                key={iv.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {iv.applicant_full_name}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">({iv.stage_title})</span>
                  </div>
                  <div className="text-slate-500 tabular-nums flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {toPersianDigits(iv.interview_date_jalali)} ساعت {toPersianDigits(iv.interview_time)}
                    </span>
                    <span>·</span>
                    <span>مکان: {iv.location}</span>
                  </div>
                  {iv.result_summary && (
                    <p className="text-slate-600 dark:text-slate-400">نتیجه: {iv.result_summary}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={iv.status}
                    onChange={(e) => handleUpdateInterviewStatus(iv.id, e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <option value="زمان‌بندی شده">زمان‌بندی شده</option>
                    <option value="انجام شده">انجام شده</option>
                    <option value="تغییر زمان یافته">تغییر زمان یافته</option>
                    <option value="لغو شده">لغو شده</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onOpenDossier(iv.application_id)}
                    className="rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 text-white font-semibold cursor-pointer"
                  >
                    ثبت امتیاز / پرونده
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODULES 8 & 16: RECRUITMENT AGE SETTINGS, AUDIT LOGS & BACKUP
// ============================================================================

export const SettingsAndUsersView: React.FC<{
  onSettingsUpdated: () => void;
  onOpenThemeGallery?: () => void;
  activeThemeId?: ThemePresetId;
  previewThemeId?: ThemePresetId | null;
  orgDefaultThemeId?: string;
  customTokens?: Partial<ThemeTokens>;
  onApplyTheme?: (
    themeId: ThemePresetId,
    options?: { setAsOrgDefault?: boolean; customTokens?: Partial<ThemeTokens> }
  ) => void;
  onStartPreview?: (themeId: ThemePresetId, customTokens?: Partial<ThemeTokens>) => void;
  onCancelPreview?: () => void;
}> = ({
  onSettingsUpdated,
  onOpenThemeGallery,
  activeThemeId = 'azure-professional',
  previewThemeId = null,
  orgDefaultThemeId = 'azure-professional',
  customTokens = {},
  onApplyTheme,
  onStartPreview,
  onCancelPreview,
}) => {
  const [settingsTab, setSettingsTab] = useState<'RECRUITMENT' | 'SMS' | 'THEMES'>('RECRUITMENT');
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [toast, setToast] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isSavingSteps, setIsSavingSteps] = useState(false);
  const [stepsToast, setStepsToast] = useState('');
  const [stepsError, setStepsError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
  };

  const fetchAll = async () => {
    const [sRes, aRes] = await Promise.all([
      fetch('/api/admin/settings', { headers }),
      fetch('/api/admin/audit-logs', { headers }),
    ]);
    const sData = await sRes.json();
    const aData = await aRes.json();
    if (sData.settings) setSettings(sData.settings);
    if (aData.auditLogs) setAuditLogs(aData.auditLogs);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !settings) return;
    setSettingsError('');

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setSettingsError('فرمت تصویر مجاز نیست. لطفاً فایل PNG، JPG یا WebP انتخاب کنید.');
      return;
    }
    if (file.size > 500 * 1024) {
      setSettingsError('حجم فایل لوگو نباید بیشتر از ۵۰۰ کیلوبایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setSettings((prev) => (prev ? { ...prev, org_logo_data_url: result } : prev));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsError('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (res.ok && data.settings) {
      setSettings(data.settings);
      setToast('تنظیمات شرایط استخدام و سربرگ چاپی با موفقیت ذخیره شد.');
      setTimeout(() => setToast(''), 3500);
      onSettingsUpdated();
      fetchAll();
    } else {
      setSettingsError(data.error || 'خطا در ذخیره‌سازی تنظیمات.');
    }
  };

  const persistRegistrationSteps = async (nextSteps: number[], feedbackText: string) => {
    if (!settings || isSavingSteps) return;
    const previousSteps = normalizeEnabledRegistrationSteps(settings.enabled_registration_steps);
    const normalizedNext = normalizeEnabledRegistrationSteps(nextSteps);

    setStepsError('');
    setStepsToast('');
    setIsSavingSteps(true);
    setSettings((prev) => (prev ? { ...prev, enabled_registration_steps: normalizedNext } : prev));

    try {
      const res = await fetch('/api/admin/settings/registration-steps', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ enabled_registration_steps: normalizedNext }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setStepsToast(feedbackText);
        setTimeout(() => setStepsToast(''), 3200);
        onSettingsUpdated();
        fetchAll();
      } else {
        setSettings((prev) => (prev ? { ...prev, enabled_registration_steps: previousSteps } : prev));
        setStepsError(data.error || 'خطا در ذخیره خودکار مراحل ثبت‌نام.');
      }
    } catch {
      setSettings((prev) => (prev ? { ...prev, enabled_registration_steps: previousSteps } : prev));
      setStepsError('خطا در برقراری ارتباط با سرور برای ذخیره مراحل ثبت‌نام.');
    } finally {
      setIsSavingSteps(false);
    }
  };

  const handleToggleRegistrationStep = (stepNum: number) => {
    if (!settings || stepNum === 1 || stepNum === 9) return;
    const currentSteps = normalizeEnabledRegistrationSteps(settings.enabled_registration_steps);
    const exists = currentSteps.includes(stepNum);
    const nextSteps = exists
      ? currentSteps.filter((s) => s !== stepNum)
      : [...currentSteps, stepNum];
    const stepTitle = REGISTRATION_STEPS_META.find((m) => m.step === stepNum)?.title || `مرحله ${stepNum}`;
    const msg = exists
      ? `مرحله «${stepTitle}» غیرفعال و بلافاصله ذخیره شد.`
      : `مرحله «${stepTitle}» فعال و بلافاصله ذخیره شد.`;
    void persistRegistrationSteps(nextSteps, msg);
  };

  const handleExportBackup = async () => {
    const res = await fetch('/api/admin/backup/export', { headers });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dasteva_backup_${Date.now()}.json`;
    a.click();
  };

  if (!settings) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        در حال بارگذاری تنظیمات استخدام...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Sub-Navigation Tabs: شرایط استخدام vs تنظیمات پیامک vs پوسته‌ها */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsTab('RECRUITMENT')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
              settingsTab === 'RECRUITMENT'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>شرایط و محدودیت‌های استخدام</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsTab('SMS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
              settingsTab === 'SMS'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>تنظیمات پیامک (فراز اس‌ام‌اس)</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsTab('THEMES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
              settingsTab === 'THEMES'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>پوسته‌ها و ظاهر (۱۰ تم آماده)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportBackup}
          className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3.5 py-2 text-xs font-bold text-blue-600 whitespace-nowrap cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>دریافت فایل پشتیبان پایگاه داده</span>
        </button>
      </div>

      {settingsTab === 'SMS' ? (
        <SmsSettingsView />
      ) : settingsTab === 'THEMES' && onApplyTheme && onStartPreview && onCancelPreview ? (
        <ThemeGalleryView
          activeThemeId={activeThemeId}
          previewThemeId={previewThemeId}
          orgDefaultThemeId={orgDefaultThemeId}
          customTokens={customTokens}
          onApplyTheme={onApplyTheme}
          onStartPreview={onStartPreview}
          onCancelPreview={onCancelPreview}
        />
      ) : (
        <>
          {/* Dynamic Registration Steps Manager (Instant Auto-Save) */}
          {(() => {
            const enabledSteps = normalizeEnabledRegistrationSteps(settings.enabled_registration_steps);
            const allEnabled = enabledSteps.length === DEFAULT_ENABLED_REGISTRATION_STEPS.length;
            return (
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      مدیریت مراحل فعال فرم ثبت‌نام متقاضیان
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      با تیک زدن یا برداشتن تیک مراحل ۲ تا ۸، همان لحظه مراحل فرم ثبت‌نام تغییر کرده و ذخیره می‌شوند. اطلاعات قبلی متقاضیان در پرونده مدیریت محفوظ می‌ماند.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {toPersianDigits(enabledSteps.length)} از ۹ مرحله فعال
                    </span>
                    {!allEnabled && (
                      <button
                        type="button"
                        disabled={isSavingSteps}
                        onClick={() =>
                          persistRegistrationSteps(
                            [...DEFAULT_ENABLED_REGISTRATION_STEPS],
                            'تمام ۹ مرحله فرم ثبت‌نام فعال و ذخیره شد.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>فعال‌سازی همه ۹ مرحله</span>
                      </button>
                    )}
                  </div>
                </div>

                {stepsToast && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{stepsToast}</span>
                  </div>
                )}

                {stepsError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{stepsError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {REGISTRATION_STEPS_META.map((stepMeta) => {
                    const isChecked = enabledSteps.includes(stepMeta.step);
                    return (
                      <label
                        key={stepMeta.step}
                        className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
                          stepMeta.required
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 cursor-not-allowed'
                            : isChecked
                            ? 'border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-400 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={stepMeta.required || isSavingSteps}
                          onChange={() => handleToggleRegistrationStep(stepMeta.step)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
                              {toPersianDigits(stepMeta.step)}. {stepMeta.title}
                            </span>
                            {stepMeta.required ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                <Lock className="w-3 h-3" />
                                <span>الزامی · ثابت</span>
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] font-bold shrink-0 ${
                                  isChecked
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {isChecked ? 'فعال' : 'غیرفعال'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {stepMeta.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          <form
            onSubmit={handleSaveSettings}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    تنظیمات شرایط استخدام و محدودیت‌های سنی شرکت دستوا
                  </h2>
                  <p className="text-xs text-slate-500">
                    شرایط سنی بانوان و آقایان به صورت پویا قابل تنظیم است و افراد خارج از محدوده مجاز امکان ثبت‌نام ندارند.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenThemeGallery && (
                  <button
                    type="button"
                    onClick={() => setSettingsTab('THEMES')}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>مدیریت پوسته‌ها و تم سامانه</span>
                  </button>
                )}
              </div>
            </div>

            {toast && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{toast}</span>
              </div>
            )}

            {settingsError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Female Age Limits */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">شرایط سنی بانوان</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">حداقل سن بانوان (سال)</label>
                    <input
                      type="number"
                      value={settings.female_min_age}
                      onChange={(e) => setSettings({ ...settings, female_min_age: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">حداکثر سن بانوان (سال)</label>
                    <input
                      type="number"
                      value={settings.female_max_age}
                      onChange={(e) => setSettings({ ...settings, female_max_age: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Male Age Limits */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">شرایط سنی آقایان</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">حداقل سن آقایان (سال)</label>
                    <input
                      type="number"
                      value={settings.male_min_age}
                      onChange={(e) => setSettings({ ...settings, male_min_age: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">حداکثر سن آقایان (سال)</label>
                    <input
                      type="number"
                      value={settings.male_max_age}
                      onChange={(e) => setSettings({ ...settings, male_max_age: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <label className="flex items-center gap-2 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.age_limit_enabled)}
                  onChange={(e) => setSettings({ ...settings, age_limit_enabled: e.target.checked ? 1 : 0 })}
                />
                <span className="font-bold">اعمال محدودیت سنی در ثبت‌نام متقاضیان</span>
              </label>

              <label className="flex items-center gap-2 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.allow_submit_without_resume)}
                  onChange={(e) => setSettings({ ...settings, allow_submit_without_resume: e.target.checked ? 1 : 0 })}
                />
                <span className="font-bold">امکان ثبت درخواست بدون نوشتن متن رزومه (اختیاری بودن رزومه)</span>
              </label>
            </div>

            {/* Print Header Organization Logo Settings */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <DastevaLogoMark orgLogoDataUrl={settings.org_logo_data_url} size={56} />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      لوگوی سربرگ تمام گزارش‌ها و چاپ‌های سامانه
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      به صورت پیش‌فرض لوگوی برداری رسمی شرکت دستوا در سربرگ چاپ‌ها درج می‌شود. در صورت تمایل می‌توانید لوگوی اختصاصی سازمان را (PNG، JPG یا WebP تا ۵۰۰ کیلوبایت) بارگذاری کنید.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 px-3.5 py-2 font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>آپلود لوگوی اختصاصی</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>

                  {settings.org_logo_data_url && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, org_logo_data_url: '' })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 px-3 py-2 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>بازگشت به لوگوی پیش‌فرض</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
            >
              ذخیره تنظیمات شرایط استخدام و سربرگ چاپی
            </button>
          </form>

          {/* Settings Change History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold mb-3">تاریخچه تغییر تنظیمات شرایط استخدام</h3>
            <div className="space-y-2 text-xs">
              {settings.settings_history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span>{h.summary} (توسط: <strong>{h.changed_by}</strong>)</span>
                  <span className="text-slate-400 tabular-nums">{toPersianDigits(h.changed_at_jalali)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Audit Logs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" />
              <span>گزارش عملیات مدیریتی سامانه</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {auditLogs.map((log, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <span className="font-bold">{String(log.actor_name)}</span> —{' '}
                    <span className="text-slate-600 dark:text-slate-300">{String(log.details)}</span>
                  </div>
                  <span className="text-slate-400 tabular-nums">{toPersianDigits(String(log.created_at_jalali))}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

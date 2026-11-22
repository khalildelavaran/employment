import React, { useState } from 'react';
import { Printer, X, CheckSquare, Square, FileText } from 'lucide-react';
import {
  ApplicantFullDossier,
  ApplicantSummaryRow,
  InterviewRecord,
} from '../types/recruitment.ts';
import { formatToman, getCurrentJalaliDateTime, toPersianDigits } from '../utils/validation.ts';

export type PrintMode =
  | 'SINGLE_DOSSIER'
  | 'BATCH_DOSSIERS'
  | 'APPLICANT_RECEIPT'
  | 'COMPARISON_REPORT'
  | 'APPLICANTS_LIST_REPORT'
  | 'INTERVIEWS_LIST_REPORT';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PrintMode;
  title: string;
  singleDossier?: ApplicantFullDossier | null;
  batchDossiers?: ApplicantFullDossier[];
  applicantsList?: ApplicantSummaryRow[];
  interviewsList?: InterviewRecord[];
  canViewEvaluations?: boolean;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  mode,
  title,
  singleDossier,
  batchDossiers = [],
  applicantsList = [],
  interviewsList = [],
  canViewEvaluations = true,
}) => {
  const [includeIdentity, setIncludeIdentity] = useState(true);
  const [includeEducationWork, setIncludeEducationWork] = useState(true);
  const [includeSalaryAndDocs, setIncludeSalaryAndDocs] = useState(true);
  const [includeEvaluations, setIncludeEvaluations] = useState(canViewEvaluations);

  // Selectable columns for list report
  const [listCols, setListCols] = useState({
    full_name: true,
    national_code: true,
    mobile: true,
    gender_age: true,
    education: true,
    proposed_salary: true,
    status: true,
    in_person_docs: true,
  });

  if (!isOpen) return null;

  const nowJalali = getCurrentJalaliDateTime();
  const dossiersToRender: ApplicantFullDossier[] =
    mode === 'SINGLE_DOSSIER' || mode === 'APPLICANT_RECEIPT'
      ? singleDossier
        ? [singleDossier]
        : []
      : batchDossiers;

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-8 overflow-hidden">
        {/* Control Bar (Hidden in Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                قالب رسمی A4 راست‌چین با فونت فارسی، سربرگ شرکت دستوا و قابلیت ذخیره مستقیم به عنوان PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerPrint}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره فایل PDF</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>بستن</span>
            </button>
          </div>
        </div>

        {/* Column / Section Selector Toolbar (Hidden in Print) */}
        {(mode === 'SINGLE_DOSSIER' || mode === 'BATCH_DOSSIERS') && (
          <div className="no-print flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">بخش‌های قابل چاپ در پرونده:</span>
            <button
              type="button"
              onClick={() => setIncludeIdentity(!includeIdentity)}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {includeIdentity ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              <span>مشخصات فردی، سکونت و بستگان</span>
            </button>
            <button
              type="button"
              onClick={() => setIncludeEducationWork(!includeEducationWork)}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {includeEducationWork ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              <span>تحصیلات و سوابق شغلی</span>
            </button>
            <button
              type="button"
              onClick={() => setIncludeSalaryAndDocs(!includeSalaryAndDocs)}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {includeSalaryAndDocs ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
              <span>حقوق پیشنهادی و پیوست‌ها</span>
            </button>
            {canViewEvaluations && (
              <button
                type="button"
                onClick={() => setIncludeEvaluations(!includeEvaluations)}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {includeEvaluations ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                <span>ارزیابی‌ها و نتایج مصاحبه</span>
              </button>
            )}
          </div>
        )}

        {mode === 'APPLICANTS_LIST_REPORT' && (
          <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">ستون‌های جدول چاپی:</span>
            {[
              { key: 'full_name', label: 'نام و نام خانوادگی' },
              { key: 'national_code', label: 'کد ملی' },
              { key: 'mobile', label: 'شماره موبایل' },
              { key: 'gender_age', label: 'جنسیت و سن' },
              { key: 'education', label: 'تحصیلات' },
              { key: 'proposed_salary', label: 'حقوق پیشنهادی' },
              { key: 'status', label: 'وضعیت استخدام' },
              { key: 'in_person_docs', label: 'مدارک حضوری' },
            ].map((col) => {
              const checked = listCols[col.key as keyof typeof listCols];
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setListCols((prev) => ({ ...prev, [col.key]: !checked }))}
                  className="flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {checked ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{col.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Printable Document Area */}
        <div className="max-h-[75vh] overflow-y-auto p-8 bg-white text-slate-900 print:max-h-none print:overflow-visible print:p-0">
          {/* Mode 1 & 2 & 3: Single Dossier, Batch Dossiers, or Applicant Receipt */}
          {(mode === 'SINGLE_DOSSIER' || mode === 'BATCH_DOSSIERS' || mode === 'APPLICANT_RECEIPT') &&
            dossiersToRender.map((d, index) => (
              <div
                key={d.application_id}
                className={`${index < dossiersToRender.length - 1 ? 'print-page-break mb-12 pb-8 border-b-2 border-dashed border-slate-300' : ''}`}
              >
                {/* Official Dasteva Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900">شرکت دستوا | واحد جذب و منابع انسانی</h1>
                    <p className="text-xs text-slate-600 mt-1">
                      {mode === 'APPLICANT_RECEIPT'
                        ? 'رسید رسمی ثبت درخواست اینترنتی استخدام'
                        : 'پرونده جامع الکترونیکی متقاضی استخدام'}
                    </p>
                  </div>
                  <div className="text-left text-xs space-y-1 tabular-nums">
                    <div>
                      <span className="text-slate-500">کد ملی متقاضی: </span>
                      <span className="font-bold text-slate-900">{toPersianDigits(d.national_code)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">تاریخ ثبت درخواست: </span>
                      <span className="font-semibold">{toPersianDigits(d.submitted_at_jalali || nowJalali)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">تاریخ تولید گزارش: </span>
                      <span>{nowJalali}</span>
                    </div>
                  </div>
                </div>

                {/* Status Summary Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-300 rounded-lg p-3.5 mb-5 bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-500 block">نام و نام خانوادگی:</span>
                    <span className="font-bold text-slate-900 text-sm">{d.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">وضعیت فعلی پرونده:</span>
                    <span className="font-bold text-slate-900">{d.status_title}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">وضعیت مدارک حضوری:</span>
                    <span className="font-semibold text-slate-900">{d.in_person_docs_status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">حقوق پیشنهادی ماهانه:</span>
                    <span className="font-bold text-slate-900 tabular-nums">{formatToman(d.proposed_salary_toman)} تومان</span>
                  </div>
                </div>

                {includeIdentity && (
                  <div className="print-avoid-break mb-5">
                    <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1.5 mb-3">
                      ۱. مشخصات هویتی، محل سکونت و اطلاعات بستگان
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">کد ملی: </span>
                        <span className="font-semibold tabular-nums">{toPersianDigits(d.national_code)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">شماره موبایل: </span>
                        <span className="font-semibold tabular-nums">{toPersianDigits(d.mobile)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">جنسیت: </span>
                        <span className="font-semibold">{d.gender}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">تاریخ تولد و سن: </span>
                        <span className="font-semibold tabular-nums">
                          {toPersianDigits(d.birth_date_jalali)} ({toPersianDigits(d.calculated_age)} سال)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">وضعیت تأهل: </span>
                        <span className="font-semibold">{d.marital_status}</span>
                      </div>
                      {d.gender === 'مرد' && (
                        <div>
                          <span className="text-slate-500">وضعیت نظام وظیفه: </span>
                          <span className="font-semibold">{d.military_status || 'ثبت نشده'}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">نام پدر: </span>
                        <span className="font-semibold">{d.father_name} ({d.father_alive_status})</span>
                      </div>
                      <div>
                        <span className="text-slate-500">شغل پدر: </span>
                        <span className="font-semibold">{d.father_job}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">شهرستان و منطقه: </span>
                        <span className="font-semibold">{d.city} - {d.district}</span>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <span className="text-slate-500">آدرس کامل محل سکونت: </span>
                        <span className="font-semibold">{d.full_address}</span>
                      </div>
                    </div>

                    {/* Contacts Table */}
                    {d.contacts && d.contacts.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-700 mb-1.5">اطلاعات بستگان و معرف:</div>
                        <table className="w-full border-collapse border border-slate-300 text-xs">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-300 px-2.5 py-1.5 text-right">نام و نام خانوادگی</th>
                              <th className="border border-slate-300 px-2.5 py-1.5 text-right">نسبت با متقاضی</th>
                              <th className="border border-slate-300 px-2.5 py-1.5 text-right">شماره همراه</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.contacts.map((c, idx) => (
                              <tr key={idx}>
                                <td className="border border-slate-300 px-2.5 py-1.5">{c.full_name}</td>
                                <td className="border border-slate-300 px-2.5 py-1.5">{c.relationship}</td>
                                <td className="border border-slate-300 px-2.5 py-1.5 tabular-nums">{toPersianDigits(c.mobile)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {includeEducationWork && (
                  <div className="print-avoid-break mb-5">
                    <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1.5 mb-3">
                      ۲. سوابق تحصیلی و تجربیات شغلی
                    </h2>
                    <table className="w-full border-collapse border border-slate-300 text-xs mb-3">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">مقطع تحصیلی</th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">رشته تحصیلی</th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">دانشگاه / مرکز آموزشی</th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">شهرستان محل تحصیل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.education.map((edu, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-300 px-2.5 py-1.5 font-semibold">{edu.degree_level}</td>
                            <td className="border border-slate-300 px-2.5 py-1.5">{edu.major}</td>
                            <td className="border border-slate-300 px-2.5 py-1.5">{edu.university_name}</td>
                            <td className="border border-slate-300 px-2.5 py-1.5">{edu.study_city}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {d.has_work_experience && d.work_experiences.length > 0 ? (
                      <table className="w-full border-collapse border border-slate-300 text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-300 px-2.5 py-1.5 text-right">نام محل کار قبلی</th>
                            <th className="border border-slate-300 px-2.5 py-1.5 text-right">عنوان شغلی</th>
                            <th className="border border-slate-300 px-2.5 py-1.5 text-right">مدت اشتغال</th>
                            <th className="border border-slate-300 px-2.5 py-1.5 text-right">شرح وظایف</th>
                            <th className="border border-slate-300 px-2.5 py-1.5 text-right">علت قطع همکاری</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.work_experiences.map((w, idx) => (
                            <tr key={idx}>
                              <td className="border border-slate-300 px-2.5 py-1.5 font-semibold">{w.company_name}</td>
                              <td className="border border-slate-300 px-2.5 py-1.5">{w.job_title}</td>
                              <td className="border border-slate-300 px-2.5 py-1.5">{w.duration_text}</td>
                              <td className="border border-slate-300 px-2.5 py-1.5">{w.responsibilities}</td>
                              <td className="border border-slate-300 px-2.5 py-1.5">{w.leaving_reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-slate-600">سابقه شغلی قبلی: فاقد سابقه شغلی ثبت‌شده</p>
                    )}
                  </div>
                )}

                {includeSalaryAndDocs && (
                  <div className="print-avoid-break mb-5">
                    <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1.5 mb-3">
                      ۳. شرایط همکاری، نحوه آشنایی و متن رزومه
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-slate-500">نحوه آشنایی با فرصت استخدام شرکت دستوا: </span>
                        <span className="font-semibold">
                          {d.acquaintance_source}
                          {d.acquaintance_note ? ` (${d.acquaintance_note})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">حقوق و مزایای توافقی پیشنهادی (ساعت ۸ الی ۱۴): </span>
                        <span className="font-bold tabular-nums">{formatToman(d.proposed_salary_toman)} تومان</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-slate-500">وضعیت تحویل مدارک حضوری در منابع انسانی: </span>
                        <span className="font-semibold">
                          {d.in_person_docs_status}
                          {d.in_person_docs_note ? ` - ${d.in_person_docs_note}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="border border-slate-300 rounded p-3 bg-slate-50 text-xs">
                      <span className="font-bold text-slate-800 block mb-1">متن رزومه متقاضی:</span>
                      <p className="whitespace-pre-line leading-relaxed text-slate-800">
                        {d.resume_text && d.resume_text.trim() ? d.resume_text : 'متن رزومه ثبت نشده است.'}
                      </p>
                    </div>
                  </div>
                )}

                {mode !== 'APPLICANT_RECEIPT' && canViewEvaluations && includeEvaluations && (
                  <div className="print-avoid-break mb-5">
                    <h2 className="text-sm font-bold text-slate-900 border-b border-slate-300 pb-1.5 mb-3">
                      ۴. نتایج مصاحبه‌ها و ارزیابی‌ها
                    </h2>
                    {d.evaluations && d.evaluations.length > 0 ? (
                      d.evaluations.map((ev, idx) => (
                        <div key={idx} className="mb-3 border border-slate-300 rounded p-3 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold">ثبت‌کننده ارزیابی: {ev.evaluator_name}</span>
                            <span className="font-bold tabular-nums">
                              امتیاز کل وزنی: {toPersianDigits(ev.total_weighted_score)} از ۱۰۰
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {ev.scores.map((sc, sIdx) => (
                              <div key={sIdx} className="border border-slate-200 px-2 py-1 rounded bg-slate-50">
                                <span className="text-slate-600">{sc.criterion_title}: </span>
                                <span className="font-bold tabular-nums">{toPersianDigits(sc.score)}/{toPersianDigits(sc.max_score)}</span>
                              </div>
                            ))}
                          </div>
                          {ev.strengths && <p className="text-slate-700"><strong>نقاط قوت:</strong> {ev.strengths}</p>}
                          {ev.weaknesses && <p className="text-slate-700"><strong>نقاط قابل بهبود:</strong> {ev.weaknesses}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">هنوز فرم ارزیابی مصاحبه برای این پرونده ثبت نشده است.</p>
                    )}
                  </div>
                )}

                {/* Official Footer */}
                <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
                  <span>سامانه جامع جذب و استخدام شرکت دستوا</span>
                  <span>محل امضا و مهر شرکت دستوا</span>
                  <span className="tabular-nums">صفحه {toPersianDigits(index + 1)} از {toPersianDigits(dossiersToRender.length)}</span>
                </div>
              </div>
            ))}

          {/* Mode 4: Comparison Report */}
          {mode === 'COMPARISON_REPORT' && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">شرکت دستوا | گزارش تحلیلی مقایسه متقاضیان استخدام</h1>
                  <p className="text-xs text-slate-600 mt-1">
                    مقایسه شاخص‌های تحصیلی، سوابق کاری، انتظارات مالی و امتیازات ارزیابی
                  </p>
                </div>
                <div className="text-left text-xs tabular-nums">
                  <div>تاریخ تولید گزارش: {nowJalali}</div>
                  <div>تعداد متقاضیان مقایسه‌شده: {toPersianDigits(batchDossiers.length)} نفر</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-right">شاخص مقایسه</th>
                    {batchDossiers.map((d) => (
                      <th key={d.application_id} className="border border-slate-300 p-2 text-right font-bold">
                        {d.full_name} ({toPersianDigits(d.national_code)})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">سن و جنسیت</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2 tabular-nums">
                        {d.gender} · {toPersianDigits(d.calculated_age)} سال
                        {!d.is_age_qualified && <span className="block text-[10px] text-amber-700">({d.age_warning_text})</span>}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">مقطع و رشته تحصیلی</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">
                        {d.primary_degree} - {d.primary_major}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">دانشگاه محل تحصیل</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">{d.primary_university}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">شهرستان و منطقه سکونت</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">{d.city} - {d.district}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">سابقه شغلی مرتبط</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2 tabular-nums">
                        {d.total_experience_months > 0
                          ? `${toPersianDigits(d.total_experience_months)} ماه (${d.work_experiences[0]?.job_title || ''})`
                          : 'فاقد سابقه'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">حقوق پیشنهادی ماهانه</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2 font-bold tabular-nums">
                        {formatToman(d.proposed_salary_toman)} تومان
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">امتیاز ارزیابی وزنی (از ۱۰۰)</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2 font-bold tabular-nums">
                        {toPersianDigits(d.avg_evaluation_score || d.avg_interview_score)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">وضعیت فعلی استخدام</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2 font-semibold">{d.status_title}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">وضعیت مدارک حضوری</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">{d.in_person_docs_status}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">نقاط قوت ثبت‌شده</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">{d.strengths_summary || '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-semibold bg-slate-50">نقاط ضعف / ملاحظات</td>
                    {batchDossiers.map((d) => (
                      <td key={d.application_id} className="border border-slate-300 p-2">{d.weaknesses_summary || '—'}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Mode 5: Applicants List Report */}
          {mode === 'APPLICANTS_LIST_REPORT' && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">شرکت دستوا | گزارش فهرست متقاضیان استخدام</h1>
                  <p className="text-xs text-slate-600 mt-1">گزارش رسمی خروجی جدول متقاضیان واحد منابع انسانی</p>
                </div>
                <div className="text-left text-xs tabular-nums">
                  <div>تاریخ گزارش: {nowJalali}</div>
                  <div>تعداد رکوردها: {toPersianDigits(applicantsList.length)} نفر</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-right">ردیف</th>
                    {listCols.full_name && <th className="border border-slate-300 p-2 text-right">نام و نام خانوادگی</th>}
                    {listCols.national_code && <th className="border border-slate-300 p-2 text-right">کد ملی</th>}
                    {listCols.mobile && <th className="border border-slate-300 p-2 text-right">موبایل</th>}
                    {listCols.gender_age && <th className="border border-slate-300 p-2 text-right">جنسیت / سن</th>}
                    {listCols.education && <th className="border border-slate-300 p-2 text-right">مقطع و رشته</th>}
                    {listCols.proposed_salary && <th className="border border-slate-300 p-2 text-right">حقوق پیشنهادی</th>}
                    {listCols.status && <th className="border border-slate-300 p-2 text-right">وضعیت استخدام</th>}
                    {listCols.in_person_docs && <th className="border border-slate-300 p-2 text-right">مدارک حضوری</th>}
                  </tr>
                </thead>
                <tbody>
                  {applicantsList.map((a, idx) => (
                    <tr key={a.application_id}>
                      <td className="border border-slate-300 p-2 tabular-nums">{toPersianDigits(idx + 1)}</td>
                      {listCols.full_name && <td className="border border-slate-300 p-2 font-semibold">{a.full_name}</td>}
                      {listCols.national_code && <td className="border border-slate-300 p-2 tabular-nums">{toPersianDigits(a.national_code)}</td>}
                      {listCols.mobile && <td className="border border-slate-300 p-2 tabular-nums">{toPersianDigits(a.mobile)}</td>}
                      {listCols.gender_age && (
                        <td className="border border-slate-300 p-2 tabular-nums">
                          {a.gender} ({toPersianDigits(a.calculated_age)})
                        </td>
                      )}
                      {listCols.education && (
                        <td className="border border-slate-300 p-2">
                          {a.primary_degree} - {a.primary_major}
                        </td>
                      )}
                      {listCols.proposed_salary && (
                        <td className="border border-slate-300 p-2 tabular-nums">{formatToman(a.proposed_salary_toman)}</td>
                      )}
                      {listCols.status && <td className="border border-slate-300 p-2">{a.status_title}</td>}
                      {listCols.in_person_docs && <td className="border border-slate-300 p-2">{a.in_person_docs_status}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mode 6: Interviews List Report */}
          {mode === 'INTERVIEWS_LIST_REPORT' && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">شرکت دستوا | برنامه زمان‌بندی و فهرست مصاحبه‌های استخدامی</h1>
                  <p className="text-xs text-slate-600 mt-1">گزارش جلسات مصاحبه واحد منابع انسانی</p>
                </div>
                <div className="text-left text-xs tabular-nums">
                  <div>تاریخ گزارش: {nowJalali}</div>
                  <div>تعداد جلسات: {toPersianDigits(interviewsList.length)} جلسه</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-right">ردیف</th>
                    <th className="border border-slate-300 p-2 text-right">نام متقاضی</th>
                    <th className="border border-slate-300 p-2 text-right">کد ملی</th>
                    <th className="border border-slate-300 p-2 text-right">عنوان مرحله</th>
                    <th className="border border-slate-300 p-2 text-right">تاریخ و ساعت</th>
                    <th className="border border-slate-300 p-2 text-right">مصاحبه‌کننده</th>
                    <th className="border border-slate-300 p-2 text-right">محل برگزاری</th>
                    <th className="border border-slate-300 p-2 text-right">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsList.map((iv, idx) => (
                    <tr key={iv.id}>
                      <td className="border border-slate-300 p-2 tabular-nums">{toPersianDigits(idx + 1)}</td>
                      <td className="border border-slate-300 p-2 font-semibold">{iv.applicant_full_name}</td>
                      <td className="border border-slate-300 p-2 tabular-nums">{toPersianDigits(iv.applicant_national_code || '')}</td>
                      <td className="border border-slate-300 p-2">{iv.stage_title}</td>
                      <td className="border border-slate-300 p-2 tabular-nums">
                        {toPersianDigits(iv.interview_date_jalali)} - ساعت {toPersianDigits(iv.interview_time)}
                      </td>
                      <td className="border border-slate-300 p-2">{iv.interviewer_name}</td>
                      <td className="border border-slate-300 p-2">{iv.location}</td>
                      <td className="border border-slate-300 p-2 font-semibold">{iv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

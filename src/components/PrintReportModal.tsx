import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckSquare, Square, FileText } from 'lucide-react';
import {
  ApplicantFullDossier,
  ApplicantSummaryRow,
  InterviewRecord,
} from '../types/recruitment.ts';
import { formatToman, getCurrentJalaliDateTime, toPersianDigits } from '../utils/validation.ts';
import { DastevaLogoMark } from './DastevaLogoMark.tsx';

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
  orgLogoDataUrl?: string;
}

const PRINT_PORTAL_ID = 'employment-print-portal';

function getOrCreatePrintPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(PRINT_PORTAL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PRINT_PORTAL_ID;
    document.body.appendChild(el);
  }
  return el;
}

function getApplicantDisplayStatus(statusCode: string, statusTitle: string, isReceipt: boolean): string {
  if (isReceipt && statusCode === 'NEW_APPLICATION') {
    return 'در انتظار مصاحبه حضوری';
  }
  return statusTitle;
}

function getApplicantNextStepLabel(docsStatus: string, isReceipt: boolean): string {
  if (isReceipt && (!docsStatus || docsStatus === 'دریافت نشده')) {
    return 'مصاحبه حضوری';
  }
  return docsStatus;
}

interface OfficialPrintHeaderProps {
  reportTitle: string;
  reportSubtitle: string;
  orgLogoDataUrl?: string;
  metaRows: Array<{ label: string; value: string }>;
}

const OfficialPrintHeader: React.FC<OfficialPrintHeaderProps> = ({
  reportTitle,
  reportSubtitle,
  orgLogoDataUrl,
  metaRows,
}) => (
  <header className="mb-5 pb-3.5 border-b-2 border-slate-900">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <DastevaLogoMark orgLogoDataUrl={orgLogoDataUrl} size={52} />
        <div>
          <div className="text-[11px] font-bold text-blue-700 tracking-tight">
            شرکت دستوا · واحد جذب و سرمایه انسانی
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 print-text-primary leading-snug mt-0.5">
            {reportTitle}
          </h1>
          <p className="text-[11px] text-slate-600 print-text-muted mt-0.5">{reportSubtitle}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-300 bg-slate-50 print-card-subtle px-3.5 py-2 text-[11px] min-w-[205px] space-y-1 tabular-nums">
        {metaRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-slate-500 print-text-muted">{row.label}:</span>
            <span className="font-bold text-slate-900 print-text-primary">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  </header>
);

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
  orgLogoDataUrl = '',
}) => {
  const [includeIdentity, setIncludeIdentity] = useState(true);
  const [includeEducationWork, setIncludeEducationWork] = useState(true);
  const [includeSalaryAndDocs, setIncludeSalaryAndDocs] = useState(true);
  const [includeEvaluations, setIncludeEvaluations] = useState(canViewEvaluations);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const root = getOrCreatePrintPortalRoot();
    setPortalContainer(root);
    document.body.classList.add('print-portal-active');
    return () => {
      document.body.classList.remove('print-portal-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const nowJalali = getCurrentJalaliDateTime();
  const isReceipt = mode === 'APPLICANT_RECEIPT';
  const dossiersToRender: ApplicantFullDossier[] =
    mode === 'SINGLE_DOSSIER' || mode === 'APPLICANT_RECEIPT'
      ? singleDossier
        ? [singleDossier]
        : []
      : batchDossiers;

  const handleTriggerPrint = () => {
    window.print();
  };

  const renderPrintableDocument = () => (
    <div dir="rtl" className="print-paper-surface text-slate-900 font-sans">
      {/* Modes 1, 2 & 3: Single Dossier, Batch Dossiers, or Compact Single-Page Applicant Receipt */}
      {(mode === 'SINGLE_DOSSIER' || mode === 'BATCH_DOSSIERS' || mode === 'APPLICANT_RECEIPT') &&
        dossiersToRender.map((d, index) => {
          const displayStatus = getApplicantDisplayStatus(d.status_code, d.status_title, isReceipt);
          const nextStepValue = getApplicantNextStepLabel(d.in_person_docs_status, isReceipt);
          const receiptCompact = isReceipt;

          return (
            <article
              key={d.application_id}
              className={`${
                index < dossiersToRender.length - 1
                  ? 'print-page-break mb-10 pb-8 border-b-2 border-dashed border-slate-300 print:mb-0 print:pb-0 print:border-b-0'
                  : ''
              }`}
            >
              <OfficialPrintHeader
                orgLogoDataUrl={orgLogoDataUrl}
                reportTitle={
                  isReceipt
                    ? 'رسید رسمی ثبت درخواست استخدام'
                    : 'پرونده جامع الکترونیکی متقاضی استخدام'
                }
                reportSubtitle={
                  isReceipt
                    ? 'تأییدیه ثبت اطلاعات متقاضی در سامانه جذب و استخدام شرکت دستوا'
                    : 'گزارش ساختاریافته اطلاعات هویتی، تحصیلی، شغلی و ارزیابی پرونده'
                }
                metaRows={[
                  { label: 'کد ملی / پیگیری', value: toPersianDigits(d.national_code) },
                  {
                    label: 'تاریخ ثبت پرونده',
                    value: toPersianDigits(d.submitted_at_jalali || nowJalali),
                  },
                  { label: 'تاریخ چاپ سند', value: nowJalali },
                ]}
              />

              {/* Executive Key Summary Grid */}
              <div className="grid grid-cols-4 gap-2.5 mb-4 print-avoid-break">
                <div className="rounded-lg border border-slate-200 bg-slate-50 print-card-subtle px-3 py-2">
                  <span className="text-[10px] text-slate-500 print-text-muted block">
                    نام و نام خانوادگی
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 print-text-primary mt-0.5 block">
                    {d.full_name}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 print-card-subtle px-3 py-2">
                  <span className="text-[10px] text-slate-500 print-text-muted block">
                    وضعیت فعلی پرونده
                  </span>
                  <span className="text-xs font-extrabold text-blue-700 mt-0.5 block">
                    {displayStatus}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 print-card-subtle px-3 py-2">
                  <span className="text-[10px] text-slate-500 print-text-muted block">
                    {isReceipt ? 'مرحله بعد' : 'وضعیت مدارک حضوری'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 print-text-primary mt-0.5 block">
                    {nextStepValue}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 print-card-subtle px-3 py-2">
                  <span className="text-[10px] text-slate-500 print-text-muted block">
                    حقوق پیشنهادی ماهانه
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 print-text-primary mt-0.5 block tabular-nums">
                    {formatToman(d.proposed_salary_toman)} تومان
                  </span>
                </div>
              </div>

              {/* Section 1: Identity, Residence & Contacts */}
              {(isReceipt || includeIdentity) && (
                <section className={`print-avoid-break ${receiptCompact ? 'mb-3.5' : 'mb-5'}`}>
                  <h2 className="text-xs font-extrabold text-slate-900 print-text-primary border-b border-slate-300 pb-1 mb-2.5 flex items-center justify-between">
                    <span>۱. مشخصات هویتی، محل سکونت و بستگان</span>
                    <span className="text-[10px] font-normal text-slate-500 tabular-nums">
                      شماره پرونده: {toPersianDigits(d.application_id)}
                    </span>
                  </h2>

                  <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-[11px] rounded-lg border border-slate-200 p-3">
                    <div>
                      <span className="text-slate-500 print-text-muted">کد ملی: </span>
                      <span className="font-bold tabular-nums">{toPersianDigits(d.national_code)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">شماره موبایل: </span>
                      <span className="font-bold tabular-nums">{toPersianDigits(d.mobile)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">جنسیت / تأهل: </span>
                      <span className="font-bold">
                        {d.gender} · {d.marital_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">تاریخ تولد و سن: </span>
                      <span className="font-bold tabular-nums">
                        {toPersianDigits(d.birth_date_jalali)} ({toPersianDigits(d.calculated_age)} سال)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">نام پدر: </span>
                      <span className="font-bold">
                        {d.father_name} ({d.father_alive_status})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">شغل پدر: </span>
                      <span className="font-bold">{d.father_job || '—'}</span>
                    </div>
                    {d.gender === 'مرد' && (
                      <div>
                        <span className="text-slate-500 print-text-muted">نظام وظیفه: </span>
                        <span className="font-bold">{d.military_status || 'ثبت نشده'}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 print-text-muted">شهر و منطقه: </span>
                      <span className="font-bold">
                        {d.city} — {d.district}
                      </span>
                    </div>
                    <div className={d.gender === 'مرد' ? 'col-span-3' : 'col-span-2'}>
                      <span className="text-slate-500 print-text-muted">آدرس کامل: </span>
                      <span className="font-semibold">{d.full_address}</span>
                    </div>
                  </div>

                  {d.contacts && d.contacts.length > 0 && (
                    <div className="mt-2.5">
                      <table className="w-full border-collapse border border-slate-300 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 print-table-head">
                            <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                              نام و نام خانوادگی بستگان / معرف
                            </th>
                            <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                              نسبت
                            </th>
                            <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                              شماره همراه
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.contacts.map((c, idx) => (
                            <tr key={idx}>
                              <td className="border border-slate-300 px-2.5 py-1 font-medium">
                                {c.full_name}
                              </td>
                              <td className="border border-slate-300 px-2.5 py-1">{c.relationship}</td>
                              <td className="border border-slate-300 px-2.5 py-1 tabular-nums">
                                {toPersianDigits(c.mobile)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Section 2: Education & Work Experience */}
              {(isReceipt || includeEducationWork) && (
                <section className={`print-avoid-break ${receiptCompact ? 'mb-3.5' : 'mb-5'}`}>
                  <h2 className="text-xs font-extrabold text-slate-900 print-text-primary border-b border-slate-300 pb-1 mb-2.5">
                    ۲. سوابق تحصیلی و تجربیات شغلی
                  </h2>

                  <table className="w-full border-collapse border border-slate-300 text-[11px] mb-2.5">
                    <thead>
                      <tr className="bg-slate-100 print-table-head">
                        <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                          مقطع تحصیلی
                        </th>
                        <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                          رشته تحصیلی
                        </th>
                        <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                          دانشگاه / مرکز آموزشی
                        </th>
                        <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                          شهر محل تحصیل
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.education.map((edu, idx) => (
                        <tr key={idx}>
                          <td className="border border-slate-300 px-2.5 py-1 font-bold">
                            {edu.degree_level}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">{edu.major}</td>
                          <td className="border border-slate-300 px-2.5 py-1">
                            {edu.university_name}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-1">{edu.study_city}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {d.has_work_experience && d.work_experiences.length > 0 ? (
                    <table className="w-full border-collapse border border-slate-300 text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 print-table-head">
                          <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                            محل کار قبلی
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                            عنوان شغلی
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                            مدت
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                            شرح وظایف
                          </th>
                          {!receiptCompact && (
                            <th className="border border-slate-300 px-2.5 py-1 text-right font-bold">
                              علت قطع همکاری
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {d.work_experiences.map((w, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-300 px-2.5 py-1 font-bold">
                              {w.company_name}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-1">{w.job_title}</td>
                            <td className="border border-slate-300 px-2.5 py-1 tabular-nums">
                              {w.duration_text}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-1">
                              {w.responsibilities}
                            </td>
                            {!receiptCompact && (
                              <td className="border border-slate-300 px-2.5 py-1">
                                {w.leaving_reason}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[11px] text-slate-600 print-text-muted">
                      سابقه شغلی قبلی: فاقد سابقه شغلی ثبت‌شده
                    </p>
                  )}
                </section>
              )}

              {/* Section 3: Financial Expectations, Acquaintance & Resume */}
              {(isReceipt || includeSalaryAndDocs) && (
                <section className={`print-avoid-break ${receiptCompact ? 'mb-3.5' : 'mb-5'}`}>
                  <h2 className="text-xs font-extrabold text-slate-900 print-text-primary border-b border-slate-300 pb-1 mb-2.5">
                    ۳. شرایط همکاری، نحوه آشنایی و خلاصه رزومه
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-[11px] mb-2">
                    <div>
                      <span className="text-slate-500 print-text-muted">نحوه آشنایی با دستوا: </span>
                      <span className="font-bold">
                        {d.acquaintance_source}
                        {d.acquaintance_note ? ` (${d.acquaintance_note})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 print-text-muted">
                        حقوق پیشنهادی (ساعت ۸ الی ۱۴):{' '}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatToman(d.proposed_salary_toman)} تومان
                      </span>
                    </div>
                    {!isReceipt && d.in_person_docs_note && (
                      <div className="col-span-2">
                        <span className="text-slate-500 print-text-muted">توضیح مدارک حضوری: </span>
                        <span className="font-semibold">{d.in_person_docs_note}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 print-card-subtle p-2.5 text-[11px]">
                    <span className="font-bold text-slate-800 block mb-1">متن رزومه متقاضی:</span>
                    <p className="whitespace-pre-line leading-relaxed text-slate-700 print-text-secondary">
                      {d.resume_text && d.resume_text.trim()
                        ? d.resume_text
                        : 'متن رزومه ثبت نشده است.'}
                    </p>
                  </div>
                </section>
              )}

              {/* Section 4: Evaluations (Admin Only) */}
              {mode !== 'APPLICANT_RECEIPT' && canViewEvaluations && includeEvaluations && (
                <section className="print-avoid-break mb-5">
                  <h2 className="text-xs font-extrabold text-slate-900 print-text-primary border-b border-slate-300 pb-1 mb-2.5">
                    ۴. نتایج مصاحبه‌ها و ارزیابی‌های تخصصی
                  </h2>
                  {d.evaluations && d.evaluations.length > 0 ? (
                    d.evaluations.map((ev, idx) => (
                      <div
                        key={idx}
                        className="mb-2.5 border border-slate-300 rounded-lg p-3 text-[11px]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold">ارزیاب: {ev.evaluator_name}</span>
                          <span className="font-extrabold text-blue-700 tabular-nums">
                            امتیاز کل وزنی: {toPersianDigits(ev.total_weighted_score)} از ۱۰۰
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 mb-2">
                          {ev.scores.map((sc, sIdx) => (
                            <div
                              key={sIdx}
                              className="border border-slate-200 px-2 py-1 rounded bg-slate-50 print-card-subtle"
                            >
                              <span className="text-slate-600">{sc.criterion_title}: </span>
                              <span className="font-bold tabular-nums">
                                {toPersianDigits(sc.score)}/{toPersianDigits(sc.max_score)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {ev.strengths && (
                          <p className="text-slate-700">
                            <strong>نقاط قوت:</strong> {ev.strengths}
                          </p>
                        )}
                        {ev.weaknesses && (
                          <p className="text-slate-700">
                            <strong>نقاط قابل بهبود:</strong> {ev.weaknesses}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      هنوز فرم ارزیابی مصاحبه برای این پرونده ثبت نشده است.
                    </p>
                  )}
                </section>
              )}

              {/* Official Footer */}
              <footer className="mt-5 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 print-text-muted print-avoid-break">
                <span>
                  {isReceipt
                    ? 'پیگیری وضعیت پرونده با کد ملی و شماره موبایل از طریق درگاه استخدام دستوا (profile.dastva.co) امکان‌پذیر است.'
                    : 'سامانه جامع جذب و استخدام شرکت دستوا (profile.dastva.co) — سند محرمانه واحد منابع انسانی'}
                </span>
                <span className="font-semibold text-slate-700">
                  {isReceipt ? 'تأییدیه سیستمی (بدون نیاز به مهر)' : 'محل امضا و تأیید واحد منابع انسانی'}
                </span>
                <span className="tabular-nums font-bold">
                  صفحه {toPersianDigits(index + 1)} از {toPersianDigits(dossiersToRender.length)}
                </span>
              </footer>
            </article>
          );
        })}

      {/* Mode 4: Comparison Report */}
      {mode === 'COMPARISON_REPORT' && (
        <div>
          <OfficialPrintHeader
            orgLogoDataUrl={orgLogoDataUrl}
            reportTitle="گزارش تحلیلی مقایسه متقاضیان استخدام"
            reportSubtitle="مقایسه تطبیقی شاخص‌های تحصیلی، سوابق کاری، انتظارات مالی و امتیازات ارزیابی"
            metaRows={[
              { label: 'تاریخ تولید گزارش', value: nowJalali },
              {
                label: 'تعداد متقاضیان',
                value: `${toPersianDigits(batchDossiers.length)} نفر`,
              },
              { label: 'نوع گزارش', value: 'مقایسه تطبیقی' },
            ]}
          />

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 print-table-head">
                <th className="border border-slate-300 p-2 text-right font-extrabold w-40">
                  شاخص مقایسه
                </th>
                {batchDossiers.map((d) => (
                  <th key={d.application_id} className="border border-slate-300 p-2 text-right font-extrabold">
                    <div>{d.full_name}</div>
                    <div className="text-[10px] font-normal text-slate-500 tabular-nums mt-0.5">
                      {toPersianDigits(d.national_code)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  سن و جنسیت
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2 tabular-nums">
                    {d.gender} · {toPersianDigits(d.calculated_age)} سال
                    {!d.is_age_qualified && (
                      <span className="block text-[10px] text-amber-700">
                        ({d.age_warning_text})
                      </span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  مقطع و رشته تحصیلی
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.primary_degree} — {d.primary_major}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  دانشگاه محل تحصیل
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.primary_university}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  شهرستان و منطقه
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.city} — {d.district}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  سابقه شغلی مرتبط
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2 tabular-nums">
                    {d.total_experience_months > 0
                      ? `${toPersianDigits(d.total_experience_months)} ماه (${d.work_experiences[0]?.job_title || ''})`
                      : 'فاقد سابقه'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  حقوق پیشنهادی ماهانه
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2 font-bold tabular-nums">
                    {formatToman(d.proposed_salary_toman)} تومان
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  امتیاز ارزیابی (از ۱۰۰)
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2 font-extrabold text-blue-700 tabular-nums">
                    {toPersianDigits(d.avg_evaluation_score || d.avg_interview_score)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  وضعیت فعلی استخدام
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2 font-semibold">
                    {d.status_title}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  وضعیت مدارک حضوری
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.in_person_docs_status}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  نقاط قوت ثبت‌شده
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.strengths_summary || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-bold bg-slate-50 print-card-subtle">
                  نقاط ضعف / ملاحظات
                </td>
                {batchDossiers.map((d) => (
                  <td key={d.application_id} className="border border-slate-300 p-2">
                    {d.weaknesses_summary || '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <footer className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <span>سامانه جامع جذب و استخدام شرکت دستوا</span>
            <span>امضا و تأیید مدیر منابع انسانی</span>
          </footer>
        </div>
      )}

      {/* Mode 5: Applicants List Report */}
      {mode === 'APPLICANTS_LIST_REPORT' && (
        <div>
          <OfficialPrintHeader
            orgLogoDataUrl={orgLogoDataUrl}
            reportTitle="گزارش رسمی فهرست متقاضیان استخدام"
            reportSubtitle="فهرست ساختاریافته پرونده‌های ثبت‌شده در واحد جذب و منابع انسانی شرکت دستوا"
            metaRows={[
              { label: 'تاریخ گزارش', value: nowJalali },
              {
                label: 'تعداد کل رکوردها',
                value: `${toPersianDigits(applicantsList.length)} نفر`,
              },
              { label: 'واحد صادرکننده', value: 'منابع انسانی' },
            ]}
          />

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 print-table-head">
                <th className="border border-slate-300 p-1.5 text-right font-bold">ردیف</th>
                {listCols.full_name && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">
                    نام و نام خانوادگی
                  </th>
                )}
                {listCols.national_code && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">کد ملی</th>
                )}
                {listCols.mobile && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">موبایل</th>
                )}
                {listCols.gender_age && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">جنسیت / سن</th>
                )}
                {listCols.education && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">
                    مقطع و رشته
                  </th>
                )}
                {listCols.proposed_salary && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">
                    حقوق پیشنهادی
                  </th>
                )}
                {listCols.status && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">
                    وضعیت استخدام
                  </th>
                )}
                {listCols.in_person_docs && (
                  <th className="border border-slate-300 p-1.5 text-right font-bold">
                    مدارک حضوری
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {applicantsList.map((a, idx) => (
                <tr key={a.application_id} className={idx % 2 === 1 ? 'bg-slate-50/70' : ''}>
                  <td className="border border-slate-300 p-1.5 tabular-nums">
                    {toPersianDigits(idx + 1)}
                  </td>
                  {listCols.full_name && (
                    <td className="border border-slate-300 p-1.5 font-bold">{a.full_name}</td>
                  )}
                  {listCols.national_code && (
                    <td className="border border-slate-300 p-1.5 tabular-nums">
                      {toPersianDigits(a.national_code)}
                    </td>
                  )}
                  {listCols.mobile && (
                    <td className="border border-slate-300 p-1.5 tabular-nums">
                      {toPersianDigits(a.mobile)}
                    </td>
                  )}
                  {listCols.gender_age && (
                    <td className="border border-slate-300 p-1.5 tabular-nums">
                      {a.gender} ({toPersianDigits(a.calculated_age)})
                    </td>
                  )}
                  {listCols.education && (
                    <td className="border border-slate-300 p-1.5">
                      {a.primary_degree} — {a.primary_major}
                    </td>
                  )}
                  {listCols.proposed_salary && (
                    <td className="border border-slate-300 p-1.5 tabular-nums">
                      {formatToman(a.proposed_salary_toman)}
                    </td>
                  )}
                  {listCols.status && (
                    <td className="border border-slate-300 p-1.5 font-semibold">{a.status_title}</td>
                  )}
                  {listCols.in_person_docs && (
                    <td className="border border-slate-300 p-1.5">{a.in_person_docs_status}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <span>سامانه جامع جذب و استخدام شرکت دستوا</span>
            <span className="tabular-nums">تاریخ چاپ: {nowJalali}</span>
          </footer>
        </div>
      )}

      {/* Mode 6: Interviews List Report */}
      {mode === 'INTERVIEWS_LIST_REPORT' && (
        <div>
          <OfficialPrintHeader
            orgLogoDataUrl={orgLogoDataUrl}
            reportTitle="برنامه زمان‌بندی و فهرست مصاحبه‌های استخدامی"
            reportSubtitle="فهرست رسمی جلسات مصاحبه حضوری برنامه‌ریزی‌شده در واحد منابع انسانی شرکت دستوا"
            metaRows={[
              { label: 'تاریخ گزارش', value: nowJalali },
              {
                label: 'تعداد جلسات',
                value: `${toPersianDigits(interviewsList.length)} جلسه`,
              },
              { label: 'واحد صادرکننده', value: 'منابع انسانی' },
            ]}
          />

          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100 print-table-head">
                <th className="border border-slate-300 p-1.5 text-right font-bold">ردیف</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">نام متقاضی</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">کد ملی</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">عنوان مرحله</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">تاریخ و ساعت</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">مصاحبه‌کننده</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">محل برگزاری</th>
                <th className="border border-slate-300 p-1.5 text-right font-bold">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {interviewsList.map((iv, idx) => (
                <tr key={iv.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : ''}>
                  <td className="border border-slate-300 p-1.5 tabular-nums">
                    {toPersianDigits(idx + 1)}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-bold">
                    {iv.applicant_full_name}
                  </td>
                  <td className="border border-slate-300 p-1.5 tabular-nums">
                    {toPersianDigits(iv.applicant_national_code || '')}
                  </td>
                  <td className="border border-slate-300 p-1.5">{iv.stage_title}</td>
                  <td className="border border-slate-300 p-1.5 tabular-nums">
                    {toPersianDigits(iv.interview_date_jalali)} — ساعت {toPersianDigits(iv.interview_time)}
                  </td>
                  <td className="border border-slate-300 p-1.5">{iv.interviewer_name}</td>
                  <td className="border border-slate-300 p-1.5">{iv.location}</td>
                  <td className="border border-slate-300 p-1.5 font-bold">{iv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <span>سامانه جامع جذب و استخدام شرکت دستوا</span>
            <span className="tabular-nums">تاریخ چاپ: {nowJalali}</span>
          </footer>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Screen Preview Modal (Hidden completely during print because #root is hidden) */}
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 overflow-y-auto">
        <div className="relative w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-8 overflow-hidden">
          {/* Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  پیش‌نمایش سند رسمی A4 با سربرگ و لوگوی سازمان — خروجی مستقیم داده‌محور بدون تکرار صفحه
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerPrint}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ / ذخیره فایل PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>بستن</span>
              </button>
            </div>
          </div>

          {/* Section Selector Toolbar */}
          {(mode === 'SINGLE_DOSSIER' || mode === 'BATCH_DOSSIERS') && (
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                بخش‌های قابل چاپ در پرونده:
              </span>
              <button
                type="button"
                onClick={() => setIncludeIdentity(!includeIdentity)}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {includeIdentity ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>مشخصات فردی، سکونت و بستگان</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeEducationWork(!includeEducationWork)}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {includeEducationWork ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>تحصیلات و سوابق شغلی</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeSalaryAndDocs(!includeSalaryAndDocs)}
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {includeSalaryAndDocs ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>حقوق پیشنهادی و رزومه</span>
              </button>
              {canViewEvaluations && (
                <button
                  type="button"
                  onClick={() => setIncludeEvaluations(!includeEvaluations)}
                  className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {includeEvaluations ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>ارزیابی‌ها و نتایج مصاحبه</span>
                </button>
              )}
            </div>
          )}

          {mode === 'APPLICANTS_LIST_REPORT' && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                ستون‌های جدول چاپی:
              </span>
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
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Crisp A4 Paper Preview Container */}
          <div className="max-h-[75vh] overflow-y-auto bg-slate-200/70 dark:bg-slate-950/70 p-4 sm:p-6">
            <div className="print-paper-surface mx-auto max-w-[210mm] rounded-lg border border-slate-300 shadow-md p-6 sm:p-8">
              {renderPrintableDocument()}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Isolated Print Portal (Only visible in @media print) */}
      {portalContainer && createPortal(renderPrintableDocument(), portalContainer)}
    </>
  );
};

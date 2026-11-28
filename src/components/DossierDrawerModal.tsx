import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Clock,
  FileCheck,
  MessageSquarePlus,
  Award,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  UserCheck,
  FileText,
  Trash2,
  Edit3,
  Save,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LIST,
  ApplicantFullDossier,
  EvaluationCriterion,
  IN_PERSON_DOCS_STATUSES,
  InPersonDocsStatus,
} from '../types/recruitment.ts';
import {
  formatToman,
  toEnglishDigits,
  toPersianDigits,
  validateIranianMobile,
  validateIranianNationalCode,
} from '../utils/validation.ts';

interface DossierDrawerModalProps {
  applicationId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: (applicationId: number) => void;
  onPrintSingle: (dossier: ApplicantFullDossier) => void;
  onScheduleInterviewForApplicant?: (applicationId: number, fullName: string) => void;
}

export const DossierDrawerModal: React.FC<DossierDrawerModalProps> = ({
  applicationId,
  onClose,
  onUpdated,
  onDeleted,
  onPrintSingle,
  onScheduleInterviewForApplicant,
}) => {
  const [dossier, setDossier] = useState<ApplicantFullDossier | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [activeTab, setActiveTab] = useState<
    'PROFILE_13' | 'WORKFLOW_AND_DOCS' | 'TIMELINE_AND_NOTES' | 'EVALUATION_AND_INTERVIEWS'
  >('PROFILE_13');

  // Workflow Status Form
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [finalDecisionNote, setFinalDecisionNote] = useState('');

  // In-person Docs Status Form
  const [inPersonDocsStatus, setInPersonDocsStatus] = useState<InPersonDocsStatus>('دریافت نشده');
  const [inPersonDocsNote, setInPersonDocsNote] = useState('');

  // Internal Note Form
  const [newNoteText, setNewNoteText] = useState('');

  // Evaluation Form
  const [evalStrengths, setEvalStrengths] = useState('');
  const [evalWeaknesses, setEvalWeaknesses] = useState('');
  const [evalComment, setEvalComment] = useState('');
  const [scoreValues, setScoreValues] = useState<Record<number, { score: number; note: string }>>({});
  const [actionToast, setActionToast] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeletingDossier, setIsDeletingDossier] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Admin Identity / Contact Edit State (National Code & Mobile)
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [editNationalCode, setEditNationalCode] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [identityEditError, setIdentityEditError] = useState('');
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
  };

  const fetchDossierData = async (id: number) => {
    const [dosRes, critRes] = await Promise.all([
      fetch(`/api/admin/applicants/${id}`),
      fetch('/api/admin/evaluations/criteria'),
    ]);
    const dosData = await dosRes.json();
    const critData = await critRes.json();

    if (dosData.dossier) {
      const d: ApplicantFullDossier = dosData.dossier;
      setDossier(d);
      setEditNationalCode(d.national_code || '');
      setEditMobile(d.mobile || '');
      setIsEditingIdentity(false);
      setIdentityEditError('');
      setSelectedStatus(d.status_code);
      setFinalDecisionNote(d.final_decision_note || '');
      setInPersonDocsStatus(d.in_person_docs_status || 'دریافت نشده');
      setInPersonDocsNote(d.in_person_docs_note || '');
      setEvalStrengths(d.strengths_summary || '');
      setEvalWeaknesses(d.weaknesses_summary || '');
    }

    if (critData.criteria) {
      setCriteria(critData.criteria);
      const initScores: Record<number, { score: number; note: string }> = {};
      critData.criteria.forEach((c: EvaluationCriterion) => {
        initScores[c.id] = { score: 8, note: '' };
      });
      setScoreValues(initScores);
    }
  };

  useEffect(() => {
    if (applicationId) {
      setConfirmDeleteOpen(false);
      setDeleteError('');
      fetchDossierData(applicationId);
    }
  }, [applicationId]);

  if (!applicationId || !dossier) return null;

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 3000);
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/applicants/${dossier.application_id}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        new_status_code: selectedStatus,
        reason: statusReason || 'به‌روزرسانی وضعیت در پرونده متقاضی',
        final_decision_note: finalDecisionNote,
      }),
    });
    const data = await res.json();
    if (res.ok && data.dossier) {
      setDossier(data.dossier);
      setStatusReason('');
      showToast('وضعیت استخدام متقاضی با موفقیت تغییر یافت و در خط زمانی ثبت شد.');
      onUpdated();
    }
  };

  const handleInPersonDocsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/applicants/${dossier.application_id}/in-person-docs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        in_person_docs_status: inPersonDocsStatus,
        in_person_docs_note: inPersonDocsNote,
      }),
    });
    const data = await res.json();
    if (res.ok && data.dossier) {
      setDossier(data.dossier);
      showToast('وضعیت دریافت مدارک حضوری در پرونده متقاضی ذخیره شد.');
      onUpdated();
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const res = await fetch(`/api/admin/applicants/${dossier.application_id}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ note_text: newNoteText }),
    });
    const data = await res.json();
    if (res.ok && data.dossier) {
      setDossier(data.dossier);
      setNewNoteText('');
      showToast('یادداشت داخلی محرمانه ثبت شد.');
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedScores = criteria.map((c) => ({
      criterion_id: c.id,
      criterion_title: c.title,
      score: scoreValues[c.id]?.score ?? 8,
      max_score: c.max_score,
      weight: c.weight,
      note: scoreValues[c.id]?.note ?? '',
    }));

    const res = await fetch(`/api/admin/applicants/${dossier.application_id}/evaluations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        interview_id: dossier.interviews[0]?.id || null,
        evaluation_type: 'INTERVIEW',
        strengths: evalStrengths,
        weaknesses: evalWeaknesses,
        general_comment: evalComment,
        scores: formattedScores,
      }),
    });
    const data = await res.json();
    if (res.ok && data.dossier) {
      setDossier(data.dossier);
      setEvalComment('');
      showToast('فرم ارزیابی و امتیازات وزنی متقاضی ثبت گردید.');
      onUpdated();
    }
  };

  const handleDeleteDossier = async () => {
    if (!dossier || isDeletingDossier) return;
    setIsDeletingDossier(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/applicants/${dossier.application_id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'خطا در حذف پرونده متقاضی.');
        return;
      }
      setConfirmDeleteOpen(false);
      if (onDeleted) {
        onDeleted(dossier.application_id);
      } else {
        onUpdated();
        onClose();
      }
    } catch {
      setDeleteError('خطا در برقراری ارتباط با سرور برای حذف پرونده.');
    } finally {
      setIsDeletingDossier(false);
    }
  };

  const handleSaveIdentityContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier || isSavingIdentity) return;
    setIdentityEditError('');

    const cleanNat = toEnglishDigits(editNationalCode).trim();
    const cleanMob = toEnglishDigits(editMobile).trim();

    const natCheck = validateIranianNationalCode(cleanNat);
    if (!natCheck.valid) {
      setIdentityEditError(natCheck.message || 'کد ملی واردشده معتبر نیست.');
      return;
    }

    const mobCheck = validateIranianMobile(cleanMob);
    if (!mobCheck.valid) {
      setIdentityEditError(mobCheck.message || 'شماره موبایل واردشده معتبر نیست.');
      return;
    }

    setIsSavingIdentity(true);
    try {
      const res = await fetch(`/api/admin/applicants/${dossier.application_id}/identity-contact`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          national_code: cleanNat,
          mobile: cleanMob,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIdentityEditError(data.error || 'خطا در ذخیره کد ملی و شماره موبایل.');
        return;
      }
      if (data.dossier) {
        setDossier(data.dossier);
        setEditNationalCode(data.dossier.national_code || cleanNat);
        setEditMobile(data.dossier.mobile || cleanMob);
      }
      setIsEditingIdentity(false);
      showToast('کد ملی و شماره موبایل متقاضی با موفقیت اصلاح شد.');
      onUpdated();
    } catch {
      setIdentityEditError('خطا در ارتباط با سرور هنگام ذخیره تغییرات.');
    } finally {
      setIsSavingIdentity(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl my-6 overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                پرونده یکپارچه استخدام: {dossier.full_name}
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                کد ملی: <strong className="text-blue-600 dark:text-blue-400">{toPersianDigits(dossier.national_code)}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              <span>وضعیت فعلی: <strong className="text-slate-900 dark:text-white">{dossier.status_title}</strong></span>
              <span>·</span>
              <span>مدارک حضوری: <strong className="text-slate-900 dark:text-white">{dossier.in_person_docs_status}</strong></span>
              <span>·</span>
              <span>حقوق پیشنهادی: <strong className="text-slate-900 dark:text-white">{formatToman(dossier.proposed_salary_toman)} تومان</strong></span>
              {!dossier.is_age_qualified && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {dossier.age_warning_text}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onScheduleInterviewForApplicant && (
              <button
                type="button"
                onClick={() => onScheduleInterviewForApplicant(dossier.application_id, dossier.full_name)}
                className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                <span>تعیین زمان مصاحبه</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onPrintSingle(dossier)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / PDF پرونده انفرادی</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError('');
                setConfirmDeleteOpen((prev) => !prev);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف پرونده</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {confirmDeleteOpen && (
          <div className="border-b border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                آیا از حذف دائمی پرونده «{dossier.full_name}» و تمامی سوابق، مصاحبه‌ها و ارزیابی‌های مرتبط اطمینان دارید؟
              </span>
              {deleteError && <span className="text-rose-700 underline">({deleteError})</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDeletingDossier}
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeletingDossier}
                onClick={handleDeleteDossier}
                className="flex items-center gap-1 rounded-lg bg-rose-600 px-3.5 py-1.5 font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingDossier ? 'در حال حذف...' : 'تأیید و حذف قطعی'}</span>
              </button>
            </div>
          </div>
        )}

        {actionToast && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionToast}</span>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 pt-3">
          {[
            { id: 'PROFILE_13', label: '۱. اطلاعات پرونده، رزومه و سوابق (بخش‌های ۱ تا ۸)' },
            { id: 'WORKFLOW_AND_DOCS', label: '۲. تغییر وضعیت استخدام و مدارک حضوری' },
            { id: 'EVALUATION_AND_INTERVIEWS', label: '۳. فرم ارزیابی مصاحبه و امتیازدهی (بخش‌های ۹ و ۱۰)' },
            { id: 'TIMELINE_AND_NOTES', label: '۴. خط زمانی (Timeline) و یادداشت‌های مدیریتی (بخش‌های ۱۱ و ۱۲)' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="max-h-[72vh] overflow-y-auto p-6 space-y-6">
          {/* TAB 1: 13-SECTION UNIFIED PROFILE (SECTIONS 1 TO 8) */}
          {activeTab === 'PROFILE_13' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      بخش ۱: اطلاعات هویتی متقاضی
                    </h3>
                    {!isEditingIdentity && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNationalCode(dossier.national_code || '');
                          setEditMobile(dossier.mobile || '');
                          setIdentityEditError('');
                          setIsEditingIdentity(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100/70 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>ویرایش کد ملی / موبایل</span>
                      </button>
                    )}
                  </div>

                  {isEditingIdentity && (
                    <form
                      onSubmit={handleSaveIdentityContact}
                      className="mb-4 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-3 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            کد ملی ۱۰ رقمی
                          </label>
                          <input
                            type="text"
                            maxLength={10}
                            value={editNationalCode}
                            onChange={(e) => setEditNationalCode(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold tabular-nums"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            شماره موبایل متقاضی
                          </label>
                          <input
                            type="tel"
                            maxLength={11}
                            value={editMobile}
                            onChange={(e) => setEditMobile(toEnglishDigits(e.target.value).replace(/\D/g, ''))}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold tabular-nums"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {identityEditError && (
                        <p className="text-rose-600 dark:text-rose-400 font-semibold">{identityEditError}</p>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSavingIdentity}
                          onClick={() => {
                            setIsEditingIdentity(false);
                            setIdentityEditError('');
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          انصراف
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingIdentity}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 font-bold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingIdentity ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-500">نام و نام خانوادگی:</span> <strong>{dossier.full_name}</strong></div>
                    <div className="tabular-nums"><span className="text-slate-500">کد ملی:</span> <strong>{toPersianDigits(dossier.national_code)}</strong></div>
                    <div className="tabular-nums"><span className="text-slate-500">شماره موبایل:</span> <strong>{toPersianDigits(dossier.mobile)}</strong></div>
                    <div><span className="text-slate-500">جنسیت:</span> <strong>{dossier.gender}</strong></div>
                    <div className="tabular-nums">
                      <span className="text-slate-500">تاریخ تولد و سن:</span>{' '}
                      <strong>{toPersianDigits(dossier.birth_date_jalali)} ({toPersianDigits(dossier.calculated_age)} سال)</strong>
                    </div>
                    <div><span className="text-slate-500">وضعیت تأهل:</span> <strong>{dossier.marital_status}</strong></div>
                    {dossier.gender === 'مرد' && (
                      <div><span className="text-slate-500">نظام وظیفه:</span> <strong>{dossier.military_status}</strong></div>
                    )}
                    <div><span className="text-slate-500">نام پدر:</span> <strong>{dossier.father_name} ({dossier.father_alive_status})</strong></div>
                    <div><span className="text-slate-500">شغل پدر:</span> <strong>{dossier.father_job}</strong></div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
                      بخش ۳، ۶ و ۷: محل سکونت، نحوه آشنایی و حقوق پیشنهادی
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div><span className="text-slate-500">شهرستان و منطقه:</span> <strong>{dossier.city} - {dossier.district}</strong></div>
                      <div><span className="text-slate-500">آدرس کامل:</span> <strong>{dossier.full_address}</strong></div>
                      <div>
                        <span className="text-slate-500">نحوه آشنایی با استخدام دستوا:</span>{' '}
                        <strong>{dossier.acquaintance_source} {dossier.acquaintance_note ? `(${dossier.acquaintance_note})` : ''}</strong>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">مبلغ پیشنهادی ماهانه (ساعت کاری ۸ الی ۱۴):</span>{' '}
                        <strong className="text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                          {formatToman(dossier.proposed_salary_toman)} تومان
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 8: Resume Text */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>بخش ۸: رزومه ثبت‌شده متقاضی</span>
                    </h4>
                    {dossier.resume_text && dossier.resume_text.trim() ? (
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
                        {dossier.resume_text}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">متن رزومه‌ای برای این متقاضی ثبت نشده است.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-3">بخش ۲ و ۴: سوابق تحصیلی و اطلاعات بستگان</h3>
                  <div className="space-y-3 text-xs">
                    {dossier.education.map((edu, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <div className="font-bold">{edu.degree_level} — {edu.major}</div>
                        <div className="text-slate-500 mt-0.5">دانشگاه: {edu.university_name} · شهرستان: {edu.study_city}</div>
                      </div>
                    ))}
                    <div className="pt-2">
                      <div className="font-bold mb-1.5">بستگان و معرف:</div>
                      {dossier.contacts.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 tabular-nums">
                          <span>{c.full_name} ({c.relationship})</span>
                          <span className="font-semibold">{toPersianDigits(c.mobile)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-3">بخش ۵: سوابق شغلی متقاضی</h3>
                  {dossier.has_work_experience && dossier.work_experiences.length > 0 ? (
                    <div className="space-y-3 text-xs">
                      {dossier.work_experiences.map((w, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">{w.job_title} در {w.company_name}</span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{w.duration_text}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">وظایف: {w.responsibilities}</p>
                          <p className="text-slate-500">علت قطع همکاری: {w.leaving_reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">متقاضی فاقد سابقه شغلی قبلی است.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORKFLOW STATUS (12 STAGES) & IN-PERSON DOCUMENT RECEIPT */}
          {activeTab === 'WORKFLOW_AND_DOCS' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleInPersonDocsUpdate}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold">وضعیت دریافت مدارک حضوری</h3>
                    <p className="text-[11px] text-slate-500">
                      ثبت وضعیت تحویل و بررسی اصل مدارک هویتی و تحصیلی در مراجعه حضوری
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">وضعیت مدارک حضوری *</label>
                  <select
                    value={inPersonDocsStatus}
                    onChange={(e) => setInPersonDocsStatus(e.target.value as InPersonDocsStatus)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                  >
                    {IN_PERSON_DOCS_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">توضیحات مدارک تحویلی یا نواقص</label>
                  <textarea
                    rows={3}
                    value={inPersonDocsNote}
                    onChange={(e) => setInPersonDocsNote(e.target.value)}
                    placeholder="مثال: اصل کارت ملی، شناسنامه و مدرک کارشناسی رویت و تطبیق داده شد..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                  />
                </div>

                {dossier.in_person_docs_received_at_jalali && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1 tabular-nums">
                    <div>تاریخ آخرین ثبت: <strong>{toPersianDigits(dossier.in_person_docs_received_at_jalali)}</strong></div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  ثبت وضعیت دریافت مدارک حضوری
                </button>
              </form>

              <form
                onSubmit={handleStatusUpdate}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold">مدیریت گردش کار و تصمیم نهایی استخدام (بخش ۱۳)</h3>
                    <p className="text-[11px] text-slate-500">
                      هر تغییر وضعیت با تاریخ، ساعت و علت تغییر در تاریخچه پرونده ثبت می‌شود.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">انتخاب مرحله جدید استخدام (۱۲ وضعیت استاندارد) *</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold"
                  >
                    {APPLICATION_STATUS_LIST.map((st) => (
                      <option key={st.code} value={st.code}>
                        {toPersianDigits(st.step_order)}. {st.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">دلیل و توضیحات تغییر وضعیت *</label>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="مثال: تأیید صلاحیت اولیه پس از بررسی رزومه و سوابق"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">جمع‌بندی تصمیم نهایی استخدام</label>
                  <textarea
                    rows={2}
                    value={finalDecisionNote}
                    onChange={(e) => setFinalDecisionNote(e.target.value)}
                    placeholder="توضیحات حکم استخدام، تاریخ شروع به کار یا علت رد درخواست..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  ذخیره وضعیت جدید در پرونده
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: EVALUATION FORM & INTERVIEWS */}
          {activeTab === 'EVALUATION_AND_INTERVIEWS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSubmitEvaluation}
                className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-bold">فرم ارزیابی مصاحبه و امتیازدهی شاخص‌ها</h3>
                  </div>
                  <span className="text-xs text-slate-500">امتیاز هر شاخص: ۱ تا ۱۰</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {criteria.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{c.title}</span>
                        <span className="text-slate-400 tabular-nums">وزن: {toPersianDigits(c.weight)}٪</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={c.max_score}
                          step={0.5}
                          value={scoreValues[c.id]?.score ?? 8}
                          onChange={(e) =>
                            setScoreValues((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], score: Number(e.target.value) },
                            }))
                          }
                          className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-center font-bold tabular-nums"
                        />
                        <input
                          type="text"
                          placeholder="توضیح کوتاه شاخص..."
                          value={scoreValues[c.id]?.note ?? ''}
                          onChange={(e) =>
                            setScoreValues((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], note: e.target.value },
                            }))
                          }
                          className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">نقاط قوت متقاضی</label>
                    <input
                      type="text"
                      value={evalStrengths}
                      onChange={(e) => setEvalStrengths(e.target.value)}
                      placeholder="مثال: تسلط بالا بر آفیس، فن بیان قوی..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">نقاط ضعف / قابل بهبود</label>
                    <input
                      type="text"
                      value={evalWeaknesses}
                      onChange={(e) => setEvalWeaknesses(e.target.value)}
                      placeholder="مثال: نیاز به آموزش اتوماسیون داخلی..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">جمع‌بندی نظر ارزیابی</label>
                  <textarea
                    rows={2}
                    value={evalComment}
                    onChange={(e) => setEvalComment(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  ثبت نهایی فرم ارزیابی در پرونده متقاضی
                </button>
              </form>

              <div className="lg:col-span-5 space-y-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-3">سوابق ارزیابی‌های ثبت‌شده ({toPersianDigits(dossier.evaluations.length)})</h3>
                  {dossier.evaluations.length > 0 ? (
                    <div className="space-y-3 text-xs">
                      {dossier.evaluations.map((ev) => (
                        <div key={ev.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">ثبت‌شده توسط: {ev.evaluator_name}</span>
                            <span className="font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                              امتیاز وزنی: {toPersianDigits(ev.total_weighted_score)} از ۱۰۰
                            </span>
                          </div>
                          {ev.strengths && <p><strong>نقاط قوت:</strong> {ev.strengths}</p>}
                          {ev.weaknesses && <p><strong>ملاحظات:</strong> {ev.weaknesses}</p>}
                          <div className="text-[11px] text-slate-400 tabular-nums">{toPersianDigits(ev.evaluated_at_jalali)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">هنوز ارزیابی ثبت نشده است.</p>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-3">جلسات مصاحبه پرونده ({toPersianDigits(dossier.interviews.length)})</h3>
                  {dossier.interviews.length > 0 ? (
                    <div className="space-y-2.5 text-xs">
                      {dossier.interviews.map((iv) => (
                        <div key={iv.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{iv.stage_title}</span>
                            <span className="font-semibold text-blue-600">{iv.status}</span>
                          </div>
                          <div className="tabular-nums text-slate-500">
                            تاریخ: {toPersianDigits(iv.interview_date_jalali)} · ساعت: {toPersianDigits(iv.interview_time)}
                          </div>
                          <div>مکان: {iv.location}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">هنوز جلسه مصاحبه‌ای برای این پرونده ثبت نشده است.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: UNIFIED TIMELINE & CONFIDENTIAL MANAGEMENT NOTES */}
          {activeTab === 'TIMELINE_AND_NOTES' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-bold">خط زمانی (Timeline) تغییرناپذیر رویدادهای پرونده</h3>
                    <p className="text-[11px] text-slate-500">
                      تمامی رویدادهای پرونده به صورت خودکار ثبت می‌شوند.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {dossier.timeline.map((ev) => (
                    <div
                      key={ev.id}
                      className="border-r-2 border-blue-600 pr-4 py-1.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{ev.title}</span>
                        <span className="text-slate-400 tabular-nums">{toPersianDigits(ev.event_date_jalali)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{ev.description}</p>
                      <div className="text-[11px] text-slate-500">
                        اقدام‌کننده: {ev.actor_name}
                        {ev.previous_status && ev.new_status
                          ? ` · تغییر از «${ev.previous_status}» به «${ev.new_status}»`
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="text-sm font-bold">یادداشت‌های مدیریتی داخلی (محرمانه)</h3>
                    <p className="text-[11px] text-slate-500">
                      این یادداشت‌ها صرفاً برای مدیر سامانه قابل مشاهده بوده و به متقاضی نمایش داده نمی‌شوند.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddInternalNote} className="space-y-2">
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="ثبت یادداشت محرمانه درباره متقاضی..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    افزودن یادداشت داخلی
                  </button>
                </form>

                <div className="space-y-2.5 pt-2">
                  {dossier.notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300">
                        <span>{n.author_name}</span>
                        <span className="tabular-nums text-[11px]">{toPersianDigits(n.created_at_jalali)}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{n.note_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

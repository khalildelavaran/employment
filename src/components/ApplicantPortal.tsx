import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Search,
  Trash2,
  UserCheck,
  AlertCircle,
  Clock,
  FileText,
  Edit3,
  Save,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import {
  ACQUAINTANCE_SOURCES,
  ApplicantFullDossier,
  ContactRecord,
  DEGREE_LEVELS,
  EducationRecord,
  MILITARY_STATUS_OPTIONS,
  RELATIVE_RELATIONSHIPS,
  WorkExperienceRecord,
} from '../types/recruitment.ts';
import {
  calculateAgeFromJalali,
  formatToman,
  parseNumericInput,
  toEnglishDigits,
  toPersianDigits,
  validateIranianMobile,
  validateIranianNationalCode,
} from '../utils/validation.ts';
import { PrintReportModal } from './PrintReportModal.tsx';

interface PublicConfig {
  default_job_title: string;
  company_districts: string[];
  allow_submit_without_resume: boolean;
  allowed_resume_formats: string[];
  max_resume_size_mb: number;
  age_limit_enabled: boolean;
  female_min_age: number;
  female_max_age: number;
  male_min_age: number;
  male_max_age: number;
  applicant_2fa_enabled?: boolean;
  otp_expiry_seconds?: number;
  otp_resend_seconds?: number;
}

const STEP_TITLES = [
  { step: 1, title: 'اطلاعات هویتی' },
  { step: 2, title: 'اطلاعات تحصیلی' },
  { step: 3, title: 'محل سکونت' },
  { step: 4, title: 'بستگان و معرف' },
  { step: 5, title: 'سوابق شغلی' },
  { step: 6, title: 'نحوه آشنایی' },
  { step: 7, title: 'انتظارات مالی' },
  { step: 8, title: 'رزومه' },
  { step: 9, title: 'بازبینی و ثبت نهایی' },
];

export const ApplicantPortal: React.FC<{ onSwitchToAdmin?: () => void }> = () => {
  const [config, setConfig] = useState<PublicConfig>({
    default_job_title: 'کارمند اداری و دفتری (ساعت کاری ۸ الی ۱۴)',
    company_districts: ['مرکز شهر شوشتر', 'فرهنگیان', 'کوی نیرو', 'دروازه', 'دولت‌آباد', 'کوی بوستان', 'سایر مناطق'],
    allow_submit_without_resume: true,
    allowed_resume_formats: ['PDF', 'DOCX'],
    max_resume_size_mb: 10,
    age_limit_enabled: true,
    female_min_age: 21,
    female_max_age: 34,
    male_min_age: 22,
    male_max_age: 36,
  });

  // Portal View Mode: 'ENTRY' | 'FORM' | 'TRACKING'
  const [viewMode, setViewMode] = useState<'ENTRY' | 'FORM' | 'TRACKING'>('ENTRY');

  // Entry inputs & 2FA OTP State
  const [entryNationalCode, setEntryNationalCode] = useState('');
  const [entryMobile, setEntryMobile] = useState('');
  const [entryError, setEntryError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [otpMaskedMobile, setOtpMaskedMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(0);
  const [otpResendSeconds, setOtpResendSeconds] = useState(0);
  const [registrationSmsNotice, setRegistrationSmsNotice] = useState(false);

  // Multi-Step Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [autoSaveToast, setAutoSaveToast] = useState('');
  const [activeDossier, setActiveDossier] = useState<ApplicantFullDossier | null>(null);
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Step 1: Identity
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [gender, setGender] = useState<'زن' | 'مرد'>('زن');
  const [birthDateJalali, setBirthDateJalali] = useState('1379/04/15');
  const [calculatedAge, setCalculatedAge] = useState<number>(26);
  const [maritalStatus, setMaritalStatus] = useState<'مجرد' | 'متأهل' | 'مطلقه'>('مجرد');
  const [militaryStatus, setMilitaryStatus] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherAliveStatus, setFatherAliveStatus] = useState<'در قید حیات' | 'در قید حیات نیستند'>('در قید حیات');
  const [fatherJob, setFatherJob] = useState('');
  const [mobile, setMobile] = useState('');

  // Step 2: Education
  const [educationList, setEducationList] = useState<EducationRecord[]>([
    { major: '', degree_level: 'کارشناسی', university_name: '', study_city: 'شوشتر' },
  ]);

  // Step 3: Residence
  const [city, setCity] = useState('شوشتر');
  const [districtInputMode, setDistrictInputMode] = useState<'list' | 'manual'>('list');
  const [district, setDistrict] = useState('مرکز شهر شوشتر');
  const [fullAddress, setFullAddress] = useState('');

  // Step 4: Relatives & Contacts
  const [contactsList, setContactsList] = useState<ContactRecord[]>([
    { full_name: '', relationship: 'پدر', mobile: '' },
  ]);

  // Step 5: Work Experience
  const [hasWorkExperience, setHasWorkExperience] = useState<boolean>(false);
  const [workList, setWorkList] = useState<WorkExperienceRecord[]>([
    {
      company_name: '',
      job_title: '',
      duration_text: '',
      duration_months: 12,
      responsibilities: '',
      leaving_reason: '',
    },
  ]);

  // Step 6: Acquaintance
  const [acquaintanceSource, setAcquaintanceSource] = useState<string>(ACQUAINTANCE_SOURCES[0]);
  const [acquaintanceNote, setAcquaintanceNote] = useState('');

  // Step 7: Financial Expectations
  const [proposedSalaryToman, setProposedSalaryToman] = useState<number>(12000000);

  // Step 8: Resume Text (Direct text storage in Cloudflare D1)
  const [resumeText, setResumeText] = useState<string>('');

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.default_job_title) {
          setConfig(data);
        }
      })
      .catch(() => {});
  }, []);

  // Automatically recalculate age whenever birthDateJalali changes
  useEffect(() => {
    const res = calculateAgeFromJalali(birthDateJalali);
    if (res.valid) {
      setCalculatedAge(res.age);
    }
  }, [birthDateJalali]);

  const populateFormFromDossier = (d: ApplicantFullDossier) => {
    setActiveDossier(d);
    setFirstName(d.first_name || '');
    setLastName(d.last_name || '');
    setNationalCode(d.national_code || '');
    setGender(d.gender || 'زن');
    setBirthDateJalali(d.birth_date_jalali || '1379/04/15');
    setCalculatedAge(d.calculated_age || 26);
    setMaritalStatus(d.marital_status || 'مجرد');
    setMilitaryStatus(d.military_status || '');
    setFatherName(d.father_name || '');
    setFatherAliveStatus((d.father_alive_status as 'در قید حیات' | 'در قید حیات نیستند') || 'در قید حیات');
    setFatherJob(d.father_job || '');
    setMobile(d.mobile || '');
    setCity(d.city || 'شوشتر');
    setDistrictInputMode(d.district_input_mode || 'list');
    setDistrict(d.district || config.company_districts[0] || '');
    setFullAddress(d.full_address || '');
    setHasWorkExperience(Boolean(d.has_work_experience));
    setAcquaintanceSource(d.acquaintance_source || ACQUAINTANCE_SOURCES[0]);
    setAcquaintanceNote(d.acquaintance_note || '');
    setProposedSalaryToman(d.proposed_salary_toman || 12000000);
    setResumeText(d.resume_text || '');

    if (d.education && d.education.length > 0) {
      setEducationList(d.education);
    }
    if (d.work_experiences && d.work_experiences.length > 0) {
      setWorkList(d.work_experiences);
    }
    if (d.contacts && d.contacts.length > 0) {
      setContactsList(d.contacts);
    }
  };

  useEffect(() => {
    if (!otpChallengeId) return;
    const timer = window.setInterval(() => {
      setOtpResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpChallengeId]);

  const enterPortalWithLookupData = (data: {
    found?: boolean;
    dossier?: ApplicantFullDossier;
    national_code?: string;
    mobile?: string;
  }) => {
    setOtpChallengeId('');
    setOtpCode('');
    if (data.found && data.dossier) {
      populateFormFromDossier(data.dossier);
      if (data.dossier.is_submitted === 1) {
        setViewMode('TRACKING');
      } else {
        setCurrentStep(data.dossier.current_step || 1);
        setViewMode('FORM');
      }
    } else {
      setNationalCode(toEnglishDigits(data.national_code || entryNationalCode));
      setMobile(toEnglishDigits(data.mobile || entryMobile));
      setCurrentStep(1);
      setViewMode('FORM');
    }
  };

  const handleStartOrLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError('');

    const natVal = validateIranianNationalCode(entryNationalCode);
    if (!natVal.valid) {
      setEntryError(natVal.message || 'کد ملی نامعتبر است.');
      return;
    }
    const mobVal = validateIranianMobile(entryMobile);
    if (!mobVal.valid) {
      setEntryError(mobVal.message || 'شماره موبایل نامعتبر است.');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = config.applicant_2fa_enabled ? '/api/public/otp/request' : '/api/public/lookup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          national_code: toEnglishDigits(entryNationalCode),
          mobile: toEnglishDigits(entryMobile),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If lookup rejected because 2FA was turned on after page load, automatically request OTP
        if (data.requires_otp && endpoint === '/api/public/lookup') {
          const otpRes = await fetch('/api/public/otp/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              national_code: toEnglishDigits(entryNationalCode),
              mobile: toEnglishDigits(entryMobile),
            }),
          });
          const otpData = await otpRes.json();
          if (otpRes.ok && otpData.challenge_id) {
            setOtpChallengeId(otpData.challenge_id);
            setOtpMaskedMobile(otpData.masked_mobile || entryMobile);
            setOtpExpirySeconds(Number(otpData.expires_in || 120));
            setOtpResendSeconds(Number(otpData.resend_after || 60));
            return;
          }
          setEntryError(otpData.error || 'خطا در ارسال کد تایید پیامکی.');
          return;
        }
        setEntryError(data.error || 'خطا در بررسی اطلاعات');
        return;
      }

      if (data.requires_otp && data.challenge_id) {
        setOtpChallengeId(data.challenge_id);
        setOtpMaskedMobile(data.masked_mobile || entryMobile);
        setOtpExpirySeconds(Number(data.expires_in || 120));
        setOtpResendSeconds(Number(data.resend_after || 60));
        setOtpCode('');
        return;
      }

      enterPortalWithLookupData(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyApplicantOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/public/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: otpChallengeId,
          code: toEnglishDigits(otpCode),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEntryError(data.error || 'کد تایید واردشده صحیح نیست.');
        return;
      }
      enterPortalWithLookupData(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendApplicantOtp = async () => {
    if (otpResendSeconds > 0 || isLoading) return;
    setEntryError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/public/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          national_code: toEnglishDigits(entryNationalCode),
          mobile: toEnglishDigits(entryMobile),
        }),
      });
      const data = await res.json();
      if (res.ok && data.challenge_id) {
        setOtpChallengeId(data.challenge_id);
        setOtpMaskedMobile(data.masked_mobile || entryMobile);
        setOtpExpirySeconds(Number(data.expires_in || 120));
        setOtpResendSeconds(Number(data.resend_after || 60));
        setOtpCode('');
      } else {
        setEntryError(data.error || 'ارسال مجدد کد تایید ناموفق بود.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateCurrentStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!firstName.trim()) errs.firstName = 'وارد کردن نام الزامی است.';
      if (!lastName.trim()) errs.lastName = 'وارد کردن نام خانوادگی الزامی است.';
      const natCheck = validateIranianNationalCode(nationalCode);
      if (!natCheck.valid) errs.nationalCode = natCheck.message || 'کد ملی نامعتبر است.';
      const ageCheck = calculateAgeFromJalali(birthDateJalali);
      if (!ageCheck.valid) {
        errs.birthDateJalali = ageCheck.message || 'تاریخ تولد نامعتبر است.';
      } else if (config.age_limit_enabled) {
        if (gender === 'زن' && (ageCheck.age < config.female_min_age || ageCheck.age > config.female_max_age)) {
          errs.birthDateJalali = `ثبت‌نام مجاز نیست: سن مجاز برای بانوان بین ${toPersianDigits(config.female_min_age)} تا ${toPersianDigits(config.female_max_age)} سال است (سن شما: ${toPersianDigits(ageCheck.age)} سال).`;
        } else if (gender === 'مرد' && (ageCheck.age < config.male_min_age || ageCheck.age > config.male_max_age)) {
          errs.birthDateJalali = `ثبت‌نام مجاز نیست: سن مجاز برای آقایان بین ${toPersianDigits(config.male_min_age)} تا ${toPersianDigits(config.male_max_age)} سال است (سن شما: ${toPersianDigits(ageCheck.age)} سال).`;
        }
      }
      if (gender === 'مرد' && !militaryStatus) {
        errs.militaryStatus = 'انتخاب وضعیت نظام وظیفه برای آقایان الزامی است.';
      }
      if (!fatherName.trim()) errs.fatherName = 'وارد کردن نام پدر الزامی است.';
      if (!fatherJob.trim()) errs.fatherJob = 'وارد کردن شغل پدر الزامی است.';
      const mobCheck = validateIranianMobile(mobile);
      if (!mobCheck.valid) errs.mobile = mobCheck.message || 'شماره موبایل نامعتبر است.';
    } else if (step === 2) {
      educationList.forEach((edu, idx) => {
        if (!edu.major.trim()) errs[`edu_major_${idx}`] = 'رشته تحصیلی الزامی است.';
        if (!edu.university_name.trim()) errs[`edu_uni_${idx}`] = 'نام دانشگاه یا مرکز آموزشی الزامی است.';
        if (!edu.study_city.trim()) errs[`edu_city_${idx}`] = 'شهرستان محل تحصیل الزامی است.';
      });
    } else if (step === 3) {
      if (!city.trim()) errs.city = 'وارد کردن شهرستان الزامی است.';
      if (!district.trim()) errs.district = 'انتخاب یا وارد کردن منطقه الزامی است.';
      if (!fullAddress.trim() || fullAddress.trim().length < 10) {
        errs.fullAddress = 'لطفاً آدرس کامل محل سکونت را با جزئیات وارد نمایید.';
      }
    } else if (step === 4) {
      contactsList.forEach((c, idx) => {
        if (!c.full_name.trim()) errs[`contact_name_${idx}`] = 'نام و نام خانوادگی بستگان الزامی است.';
        const mCheck = validateIranianMobile(c.mobile);
        if (!mCheck.valid) errs[`contact_mobile_${idx}`] = mCheck.message || 'شماره همراه نامعتبر است.';
      });
    } else if (step === 5) {
      if (hasWorkExperience) {
        workList.forEach((w, idx) => {
          if (!w.company_name.trim()) errs[`work_company_${idx}`] = 'نام محل کار قبلی الزامی است.';
          if (!w.job_title.trim()) errs[`work_title_${idx}`] = 'عنوان شغلی الزامی است.';
          if (!w.duration_text.trim()) errs[`work_dur_${idx}`] = 'مدت اشتغال الزامی است.';
          if (!w.responsibilities.trim()) errs[`work_resp_${idx}`] = 'شرح وظایف الزامی است.';
          if (!w.leaving_reason.trim()) errs[`work_reason_${idx}`] = 'علت قطع همکاری الزامی است.';
        });
      }
    } else if (step === 6) {
      if (!acquaintanceSource) errs.acquaintanceSource = 'انتخاب نحوه آشنایی الزامی است.';
      if (acquaintanceSource === 'سایر موارد' && !acquaintanceNote.trim()) {
        errs.acquaintanceNote = 'لطفاً توضیحات نحوه آشنایی را وارد نمایید.';
      }
    } else if (step === 7) {
      if (!proposedSalaryToman || proposedSalaryToman < 1000000) {
        errs.proposedSalaryToman = 'لطفاً مبلغ پیشنهادی ماهانه را به تومان (حداقل ۱,۰۰۰,۰۰۰ تومان) وارد کنید.';
      }
    } else if (step === 8) {
      if (!config.allow_submit_without_resume && !resumeText.trim()) {
        errs.resume = 'نوشتن متن رزومه برای ثبت درخواست الزامی است.';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const triggerAutoSave = async (targetStep: number): Promise<ApplicantFullDossier | null> => {
    try {
      const res = await fetch('/api/public/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          national_code: nationalCode,
          gender,
          birth_date_jalali: birthDateJalali,
          marital_status: maritalStatus,
          military_status: gender === 'مرد' ? militaryStatus : '',
          father_name: fatherName,
          father_alive_status: fatherAliveStatus,
          father_job: fatherJob,
          mobile,
          city,
          district,
          district_input_mode: districtInputMode,
          full_address: fullAddress,
          has_work_experience: hasWorkExperience,
          education: educationList,
          work_experiences: hasWorkExperience ? workList : [],
          contacts: contactsList,
          acquaintance_source: acquaintanceSource,
          acquaintance_note: acquaintanceNote,
          proposed_salary_toman: proposedSalaryToman,
          resume_text: resumeText,
          current_step: targetStep,
          allow_edit_before_submit: isEditingSubmitted,
        }),
      });
      const data = await res.json();
      if (res.ok && data.dossier) {
        setActiveDossier(data.dossier);
        setAutoSaveToast('اطلاعات این مرحله به صورت خودکار ذخیره شد.');
        setTimeout(() => setAutoSaveToast(''), 2800);
        return data.dossier;
      } else if (data.error) {
        setFieldErrors({ global: data.error });
        return null;
      }
    } catch {
      // ignore transient network error
    }
    return null;
  };

  const handleNextStep = async () => {
    if (!validateCurrentStep(currentStep)) return;
    const nextStep = Math.min(9, currentStep + 1);
    const saved = await triggerAutoSave(nextStep);
    if (saved) {
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setFieldErrors({});
    try {
      const saved = await triggerAutoSave(9);
      const appId = saved?.application_id || activeDossier?.application_id;
      if (!appId) {
        setFieldErrors({ global: 'ابتدا اطلاعات مراحل قبل را تکمیل نمایید.' });
        return;
      }

      const res = await fetch('/api/public/submit-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: appId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors({ global: data.error || 'خطا در ثبت نهایی درخواست' });
        return;
      }

      setActiveDossier(data.dossier);
      setIsEditingSubmitted(false);
      setRegistrationSmsNotice(Boolean(data.sms_dispatched));
      setViewMode('TRACKING');
    } finally {
      setIsLoading(false);
    }
  };

  const completionPercentage = Math.round(((currentStep - 1) / 8) * 100);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Following Strict 3-Zone Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('ENTRY');
          }}
          className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          سامانه استخدام شرکت دستوا
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => {
              setViewMode('ENTRY');
            }}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ثبت درخواست / پیگیری وضعیت پرونده
          </button>
          <a
            href="#conditions"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            شرایط همکاری
          </a>
          <a
            href="#process"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            مراحل جذب
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            درگاه رسمی جذب و استخدام
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* VIEW 1: ENTRY & JOB INTRODUCTION */}
        {viewMode === 'ENTRY' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Right Column: Job Opportunity Introduction */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                    فراخوان رسمی جذب سرمایه انسانی · شوشتر و حومه
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4">
                    فرصت استخدام در شرکت دستوا
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                    شرکت دستوا به منظور تکمیل کادر اداری و دفتری خود از متقاضیان واجد شرایط، مستعد و متعهد دعوت به همکاری می‌نماید. تمامی مراحل ثبت درخواست، بررسی رزومه و اعلام زمان مصاحبه از طریق این درگاه یکپارچه انجام می‌شود.
                  </p>

                  <div id="conditions" className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">عنوان موقعیت شغلی:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{config.default_job_title}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">ساعت کاری:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">۸:۰۰ صبح الی ۱۴:۰۰</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">حقوق و مزایا:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">بیمه و مزایای قانونی اداره کار + حقوق توافقی</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500 dark:text-slate-400">شرایط سنی مجاز ثبت‌نام:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {config.age_limit_enabled
                          ? `بانوان: ${toPersianDigits(config.female_min_age)} تا ${toPersianDigits(config.female_max_age)} سال · آقایان: ${toPersianDigits(config.male_min_age)} تا ${toPersianDigits(config.male_max_age)} سال`
                          : 'بدون محدودیت سنی'}
                      </span>
                    </div>
                  </div>
                </div>

                <div id="process" className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>۰۱. تکمیل فرم ۹ مرحله‌ای</span>
                  <span>·</span>
                  <span>۰۲. بررسی رزومه در منابع انسانی</span>
                  <span>·</span>
                  <span>۰۳. مصاحبه حضوری و تحویل مدارک</span>
                  <span>·</span>
                  <span>۰۴. تصمیم نهایی و شروع همکاری</span>
                </div>
              </div>

              {/* Left Column: Applicant Login / Tracking Card */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      {otpChallengeId && <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />}
                      <span>
                        {otpChallengeId
                          ? 'تایید هویت دومرحله‌ای با کد پیامکی'
                          : 'ورود، ثبت‌نام و پیگیری وضعیت پرونده'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {otpChallengeId
                        ? `کد تایید ۶ رقمی به شماره ${toPersianDigits(otpMaskedMobile)} ارسال شد. لطفاً آن را وارد کنید.`
                        : config.applicant_2fa_enabled
                        ? 'کد ملی و شماره موبایل خود را وارد نمایید تا کد تایید پیامکی برای شما ارسال شود.'
                        : 'جهت ثبت درخواست جدید، ادامه تکمیل فرم یا مشاهده وضعیت پرونده، کد ملی و شماره موبایل خود را وارد نمایید.'}
                    </p>
                  </div>

                  {!otpChallengeId ? (
                    <form onSubmit={handleStartOrLookup} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          کد ملی ۱۰ رقمی متقاضی
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={entryNationalCode}
                          onChange={(e) => setEntryNationalCode(e.target.value)}
                          placeholder="مثال: 0012345678"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          شماره موبایل متقاضی
                        </label>
                        <input
                          type="tel"
                          maxLength={11}
                          value={entryMobile}
                          onChange={(e) => setEntryMobile(e.target.value)}
                          placeholder="مثال: 09164112288"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      {entryError && (
                        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{entryError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {config.applicant_2fa_enabled ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span>
                          {isLoading
                            ? 'در حال ارسال و بررسی...'
                            : config.applicant_2fa_enabled
                            ? 'ارسال کد تایید پیامکی و ادامه'
                            : 'ورود به فرم استخدام / پیگیری وضعیت'}
                        </span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyApplicantOtp} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            کد تایید ۶ رقمی پیامک‌شده
                          </label>
                          <span className="text-xs text-slate-500 tabular-nums">
                            اعتبار: {toPersianDigits(Math.floor(otpExpirySeconds / 60))}:
                            {toPersianDigits(String(otpExpirySeconds % 60).padStart(2, '0'))}
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          maxLength={6}
                          autoFocus
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="• • • • • •"
                          required
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-center text-lg font-mono tracking-[0.5em] tabular-nums focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      {entryError && (
                        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{entryError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || otpCode.trim().length < 6}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isLoading ? 'در حال تایید کد...' : 'تایید کد و ورود به سامانه'}</span>
                      </button>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <button
                          type="button"
                          onClick={handleResendApplicantOtp}
                          disabled={otpResendSeconds > 0 || isLoading}
                          className="font-bold text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer tabular-nums"
                        >
                          {otpResendSeconds > 0
                            ? `ارسال مجدد کد (${toPersianDigits(otpResendSeconds)} ثانیه)`
                            : 'ارسال مجدد کد تایید'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpChallengeId('');
                            setOtpCode('');
                            setEntryError('');
                          }}
                          className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          ویرایش شماره موبایل
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  اطلاعات شما در هر مرحله به‌صورت خودکار ذخیره می‌شود و پس از ثبت نهایی، پیامک تایید ثبت‌نام به شماره موبایل شما ارسال خواهد شد.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: 9-STEP MULTI-STEP RECRUITMENT FORM */}
        {viewMode === 'FORM' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
            {/* Progress Bar & Percentage Header */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    مرحله {toPersianDigits(currentStep)} از ۹ · {STEP_TITLES[currentStep - 1].title}
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                    فرم جامع درخواست استخدام شرکت دستوا
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  {autoSaveToast && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Save className="w-3.5 h-3.5" />
                      {autoSaveToast}
                    </span>
                  )}
                  <div className="text-left">
                    <span className="text-xs text-slate-500 dark:text-slate-400">درصد تکمیل فرم: </span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                      {toPersianDigits(completionPercentage)}٪
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.max(8, completionPercentage)}%` }}
                />
              </div>

              {/* Stepper Navigation Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 mt-4">
                {STEP_TITLES.map((s) => {
                  const isActive = s.step === currentStep;
                  const isDone = s.step < currentStep;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        if (s.step < currentStep) setCurrentStep(s.step);
                      }}
                      className={`text-right px-2.5 py-2 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                        isActive
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
                          : isDone
                          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="tabular-nums font-bold">{toPersianDigits(s.step)}</div>
                      <div className="truncate">{s.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {fieldErrors.global && (
              <div className="mb-6 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 text-xs text-rose-700 dark:text-rose-300">
                {fieldErrors.global}
              </div>
            )}

            {/* STEP 1: IDENTITY INFORMATION */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۱. نام *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.firstName && <p className="text-xs text-rose-600 mt-1">{fieldErrors.firstName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۲. نام خانوادگی *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.lastName && <p className="text-xs text-rose-600 mt-1">{fieldErrors.lastName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۳. کد ملی ۱۰ رقمی *</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={nationalCode}
                      onChange={(e) => setNationalCode(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums"
                    />
                    {fieldErrors.nationalCode && <p className="text-xs text-rose-600 mt-1">{fieldErrors.nationalCode}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۴. جنسیت *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'زن' | 'مرد')}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    >
                      <option value="زن">زن</option>
                      <option value="مرد">مرد</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۵. تاریخ تولد شمسی (سال/ماه/روز) *</label>
                    <input
                      type="text"
                      value={birthDateJalali}
                      onChange={(e) => setBirthDateJalali(e.target.value)}
                      placeholder="1379/04/15"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums"
                    />
                    {fieldErrors.birthDateJalali && <p className="text-xs text-rose-600 mt-1">{fieldErrors.birthDateJalali}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۶. سن محاسبه‌شده خودکار (غیرقابل ویرایش)</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={`${toPersianDigits(calculatedAge)} سال`}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3.5 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۷. وضعیت تأهل *</label>
                    <select
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value as 'مجرد' | 'متأهل' | 'مطلقه')}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    >
                      <option value="مجرد">مجرد</option>
                      <option value="متأهل">متأهل</option>
                      <option value="مطلقه">مطلقه</option>
                    </select>
                  </div>

                  {/* Conditional Field 8: Only displayed for Male applicants */}
                  {gender === 'مرد' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">۸. وضعیت نظام وظیفه (ویژه آقایان) *</label>
                      <select
                        value={militaryStatus}
                        onChange={(e) => setMilitaryStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                      >
                        <option value="">انتخاب کنید...</option>
                        {MILITARY_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.militaryStatus && <p className="text-xs text-rose-600 mt-1">{fieldErrors.militaryStatus}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۹. نام پدر *</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.fatherName && <p className="text-xs text-rose-600 mt-1">{fieldErrors.fatherName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۱۰. وضعیت حیات پدر *</label>
                    <select
                      value={fatherAliveStatus}
                      onChange={(e) => setFatherAliveStatus(e.target.value as 'در قید حیات' | 'در قید حیات نیستند')}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    >
                      <option value="در قید حیات">در قید حیات</option>
                      <option value="در قید حیات نیستند">در قید حیات نیستند</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۱۱. شغل پدر *</label>
                    <input
                      type="text"
                      value={fatherJob}
                      onChange={(e) => setFatherJob(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.fatherJob && <p className="text-xs text-rose-600 mt-1">{fieldErrors.fatherJob}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۱۲. شماره موبایل متقاضی *</label>
                    <input
                      type="tel"
                      maxLength={11}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums"
                    />
                    {fieldErrors.mobile && <p className="text-xs text-rose-600 mt-1">{fieldErrors.mobile}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: EDUCATION INFORMATION */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    اطلاعات آخرین مدرک تحصیلی یا تمامی مقاطع تحصیلی خود را وارد نمایید.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setEducationList([
                        ...educationList,
                        { major: '', degree_level: 'کارشناسی', university_name: '', study_city: 'شوشتر' },
                      ])
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن سابقه تحصیلی جدید</span>
                  </button>
                </div>

                {educationList.map((edu, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        سابقه تحصیلی شماره {toPersianDigits(idx + 1)}
                      </span>
                      {educationList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEducationList(educationList.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1">۱. رشته تحصیلی *</label>
                        <input
                          type="text"
                          value={edu.major}
                          onChange={(e) => {
                            const copy = [...educationList];
                            copy[idx] = { ...copy[idx], major: e.target.value };
                            setEducationList(copy);
                          }}
                          placeholder="مثال: حسابداری / کامپیوتر"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                        {fieldErrors[`edu_major_${idx}`] && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors[`edu_major_${idx}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">۲. مقطع تحصیلی *</label>
                        <select
                          value={edu.degree_level}
                          onChange={(e) => {
                            const copy = [...educationList];
                            copy[idx] = { ...copy[idx], degree_level: e.target.value };
                            setEducationList(copy);
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          {DEGREE_LEVELS.map((deg) => (
                            <option key={deg} value={deg}>
                              {deg}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">۳. نام دانشگاه یا مرکز آموزشی *</label>
                        <input
                          type="text"
                          value={edu.university_name}
                          onChange={(e) => {
                            const copy = [...educationList];
                            copy[idx] = { ...copy[idx], university_name: e.target.value };
                            setEducationList(copy);
                          }}
                          placeholder="مثال: دانشگاه آزاد شوشتر"
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                        {fieldErrors[`edu_uni_${idx}`] && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors[`edu_uni_${idx}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">۴. شهرستان محل تحصیل *</label>
                        <input
                          type="text"
                          value={edu.study_city}
                          onChange={(e) => {
                            const copy = [...educationList];
                            copy[idx] = { ...copy[idx], study_city: e.target.value };
                            setEducationList(copy);
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                        {fieldErrors[`edu_city_${idx}`] && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors[`edu_city_${idx}`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 3: RESIDENCE INFORMATION */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">۱. شهرستان محل سکونت *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="مثال: شوشتر"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.city && <p className="text-xs text-rose-600 mt-1">{fieldErrors.city}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold">۲. منطقه محل سکونت *</label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setDistrictInputMode('list');
                            setDistrict(config.company_districts[0] || '');
                          }}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            districtInputMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          انتخاب از فهرست مناطق
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDistrictInputMode('manual');
                            setDistrict('');
                          }}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            districtInputMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        >
                          ورود دستی منطقه
                        </button>
                      </div>
                    </div>

                    {districtInputMode === 'list' ? (
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                      >
                        {config.company_districts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="نام محله یا منطقه خود را تایپ کنید..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                      />
                    )}
                    {fieldErrors.district && <p className="text-xs text-rose-600 mt-1">{fieldErrors.district}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">۳. آدرس کامل محل سکونت *</label>
                  <textarea
                    rows={3}
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    placeholder="خیابان اصلی، خیابان فرعی، کوچه، پلاک، واحد..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                  />
                  {fieldErrors.fullAddress && <p className="text-xs text-rose-600 mt-1">{fieldErrors.fullAddress}</p>}
                </div>
              </div>
            )}

            {/* STEP 4: RELATIVES & CONTACTS */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    مشخصات حداقل یکی از بستگان درجه یک یا معرف قابل دسترس را وارد نمایید.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setContactsList([...contactsList, { full_name: '', relationship: 'پدر', mobile: '' }])
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن ردیف بستگان</span>
                  </button>
                </div>

                {contactsList.map((c, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div>
                      <label className="block text-xs font-semibold mb-1">۱. نام و نام خانوادگی بستگان *</label>
                      <input
                        type="text"
                        value={c.full_name}
                        onChange={(e) => {
                          const copy = [...contactsList];
                          copy[idx] = { ...copy[idx], full_name: e.target.value };
                          setContactsList(copy);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                      {fieldErrors[`contact_name_${idx}`] && (
                        <p className="text-xs text-rose-600 mt-1">{fieldErrors[`contact_name_${idx}`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">۲. نسبت با متقاضی *</label>
                      <select
                        value={c.relationship}
                        onChange={(e) => {
                          const copy = [...contactsList];
                          copy[idx] = { ...copy[idx], relationship: e.target.value };
                          setContactsList(copy);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      >
                        {RELATIVE_RELATIONSHIPS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold">۳. شماره همراه بستگان *</label>
                        {contactsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setContactsList(contactsList.filter((_, i) => i !== idx))}
                            className="text-xs text-rose-600 cursor-pointer"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                      <input
                        type="tel"
                        maxLength={11}
                        value={c.mobile}
                        onChange={(e) => {
                          const copy = [...contactsList];
                          copy[idx] = { ...copy[idx], mobile: e.target.value };
                          setContactsList(copy);
                        }}
                        placeholder="0916..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
                      />
                      {fieldErrors[`contact_mobile_${idx}`] && (
                        <p className="text-xs text-rose-600 mt-1">{fieldErrors[`contact_mobile_${idx}`]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 5: WORK EXPERIENCE */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <p className="text-sm font-bold mb-3">آیا سابقه شغلی دارید؟</p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={hasWorkExperience}
                        onChange={() => setHasWorkExperience(true)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span>دارم</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={!hasWorkExperience}
                        onChange={() => setHasWorkExperience(false)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span>ندارم</span>
                    </label>
                  </div>
                </div>

                {hasWorkExperience && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        فهرست سوابق شغلی قبلی:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setWorkList([
                            ...workList,
                            {
                              company_name: '',
                              job_title: '',
                              duration_text: '',
                              duration_months: 12,
                              responsibilities: '',
                              leaving_reason: '',
                            },
                          ])
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن سابقه شغلی دیگر</span>
                      </button>
                    </div>

                    {workList.map((w, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 bg-slate-50/40 dark:bg-slate-800/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">سابقه شغلی شماره {toPersianDigits(idx + 1)}</span>
                          {workList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setWorkList(workList.filter((_, i) => i !== idx))}
                              className="text-xs text-rose-600 cursor-pointer"
                            >
                              حذف
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold mb-1">نام محل کار قبلی *</label>
                            <input
                              type="text"
                              value={w.company_name}
                              onChange={(e) => {
                                const copy = [...workList];
                                copy[idx] = { ...copy[idx], company_name: e.target.value };
                                setWorkList(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            />
                            {fieldErrors[`work_company_${idx}`] && (
                              <p className="text-xs text-rose-600 mt-1">{fieldErrors[`work_company_${idx}`]}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold mb-1">عنوان شغلی *</label>
                            <input
                              type="text"
                              value={w.job_title}
                              onChange={(e) => {
                                const copy = [...workList];
                                copy[idx] = { ...copy[idx], job_title: e.target.value };
                                setWorkList(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            />
                            {fieldErrors[`work_title_${idx}`] && (
                              <p className="text-xs text-rose-600 mt-1">{fieldErrors[`work_title_${idx}`]}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold mb-1">مدت اشتغال *</label>
                            <input
                              type="text"
                              value={w.duration_text}
                              onChange={(e) => {
                                const copy = [...workList];
                                copy[idx] = { ...copy[idx], duration_text: e.target.value };
                                setWorkList(copy);
                              }}
                              placeholder="مثال: ۲ سال"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            />
                            {fieldErrors[`work_dur_${idx}`] && (
                              <p className="text-xs text-rose-600 mt-1">{fieldErrors[`work_dur_${idx}`]}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold mb-1">شرح وظایف و تجربیات *</label>
                            <textarea
                              rows={2}
                              value={w.responsibilities}
                              onChange={(e) => {
                                const copy = [...workList];
                                copy[idx] = { ...copy[idx], responsibilities: e.target.value };
                                setWorkList(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            />
                            {fieldErrors[`work_resp_${idx}`] && (
                              <p className="text-xs text-rose-600 mt-1">{fieldErrors[`work_resp_${idx}`]}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold mb-1">علت قطع همکاری *</label>
                            <textarea
                              rows={2}
                              value={w.leaving_reason}
                              onChange={(e) => {
                                const copy = [...workList];
                                copy[idx] = { ...copy[idx], leaving_reason: e.target.value };
                                setWorkList(copy);
                              }}
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            />
                            {fieldErrors[`work_reason_${idx}`] && (
                              <p className="text-xs text-rose-600 mt-1">{fieldErrors[`work_reason_${idx}`]}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: ACQUAINTANCE SOURCE */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <p className="text-sm font-bold">از چه طریقی با فرصت استخدام شرکت دستوا آشنا شدید؟</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACQUAINTANCE_SOURCES.map((src) => (
                    <label
                      key={src}
                      className={`flex items-center gap-3 p-3.5 rounded-lg border text-xs sm:text-sm cursor-pointer transition-colors ${
                        acquaintanceSource === src
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 font-bold text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="acquaintance"
                        checked={acquaintanceSource === src}
                        onChange={() => setAcquaintanceSource(src)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span>{src}</span>
                    </label>
                  ))}
                </div>

                {acquaintanceSource === 'سایر موارد' && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold mb-1.5">لطفاً نحوه آشنایی خود را توضیح دهید *</label>
                    <input
                      type="text"
                      value={acquaintanceNote}
                      onChange={(e) => setAcquaintanceNote(e.target.value)}
                      placeholder="توضیحات نحوه آشنایی..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
                    />
                    {fieldErrors.acquaintanceNote && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.acquaintanceNote}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: FINANCIAL EXPECTATIONS */}
            {currentStep === 7 && (
              <div className="space-y-5">
                <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
                  <p className="text-sm font-bold leading-relaxed text-slate-900 dark:text-white">
                    «چنانچه ساعت کاری شما از ۸ صبح تا ۱۴ باشد و به‌عنوان کارمند اداری استخدام شوید، علاوه بر حق بیمه و مزایای قانونی اداره کار، چه مبلغی را به‌عنوان حقوق و مزایای توافقی ماهانه از کارفرما پیشنهاد می‌کنید؟»
                  </p>
                </div>

                <div className="max-w-md">
                  <label className="block text-xs font-semibold mb-1.5">
                    مبلغ پیشنهادی ماهانه (واحد پول: تومان) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatToman(proposedSalaryToman)}
                      onChange={(e) => setProposedSalaryToman(parseNumericInput(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base font-extrabold tabular-nums"
                    />
                    <span className="absolute left-3.5 top-3 text-xs font-semibold text-slate-500">تومان</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 tabular-nums">
                    مبلغ ثبت‌شده با جداکننده هزارگان: <strong>{formatToman(proposedSalaryToman)} تومان در ماه</strong>
                  </p>
                  {fieldErrors.proposedSalaryToman && (
                    <p className="text-xs text-rose-600 mt-1">{fieldErrors.proposedSalaryToman}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 8: RESUME TEXTAREA */}
            {currentStep === 8 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-sm font-bold text-slate-900 dark:text-white">
                      رزومه {!config.allow_submit_without_resume && '*'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!resumeText.trim()) {
                          setResumeText(
                            `۱. خلاصه توانمندی‌ها و معرفی فردی:\nآمادگی کامل جهت فعالیت به عنوان کارمند اداری و دفتری در ساعت کاری ۸ الی ۱۴ با دقت، نظم و مسئولیت‌پذیری بالا.\n\n۲. مهارت‌های کامپیوتری و نرم‌افزاری:\n- تسلط بر نرم‌افزارهای Word و Excel\n- آشنایی با اتوماسیون اداری، تایپ سریع و بایگانی اسناد\n\n۳. دوره‌های آموزشی و گواهینامه‌ها:\n- مهارت‌های هفت‌گانه ICDL\n\n۴. سایر توضیحات و نقاط قوت:\n- روابط عمومی مناسب و توانایی کار تیمی`
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>درج قالب آماده رزومه</span>
                    </button>
                  </div>

                  <textarea
                    rows={10}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="متن کامل رزومه، مهارت‌های اداری و کامپیوتری، دوره‌های آموزشی و تجربیات خود را در این کادر وارد نمایید..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm leading-relaxed focus:border-blue-600 focus:outline-none"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {config.allow_submit_without_resume
                        ? 'ثبت رزومه اختیاری است اما در بررسی اولیه درخواست تاثیر مستقیم دارد.'
                        : 'نوشتن رزومه جهت ثبت نهایی درخواست الزامی است.'}
                    </span>
                    <span className="tabular-nums">
                      تعداد نویسه‌ها: {toPersianDigits(resumeText.length)}
                    </span>
                  </div>
                </div>

                {fieldErrors.resume && <p className="text-xs text-rose-600 font-semibold">{fieldErrors.resume}</p>}
              </div>
            )}

            {/* STEP 9: REVIEW & FINAL SUBMIT */}
            {currentStep === 9 && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">بازبینی نهایی اطلاعات پیش از ثبت قطعی</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      لطفاً خلاصه اطلاعات واردشده را بررسی کنید. در صورت نیاز به اصلاح هر بخش، روی دکمه «ویرایش» همان بخش کلیک کنید.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white">۱. اطلاعات هویتی</span>
                      <button type="button" onClick={() => setCurrentStep(1)} className="text-blue-600 flex items-center gap-1 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /> ویرایش
                      </button>
                    </div>
                    <p>نام و نام خانوادگی: <strong>{firstName} {lastName}</strong></p>
                    <p className="tabular-nums">کد ملی: <strong>{toPersianDigits(nationalCode)}</strong> · موبایل: <strong>{toPersianDigits(mobile)}</strong></p>
                    <p className="tabular-nums">جنسیت: {gender} · تاریخ تولد: {toPersianDigits(birthDateJalali)} ({toPersianDigits(calculatedAge)} سال)</p>
                    <p>وضعیت تأهل: {maritalStatus} {gender === 'مرد' ? `· نظام وظیفه: ${militaryStatus}` : ''}</p>
                    <p>نام پدر: {fatherName} ({fatherAliveStatus}) · شغل پدر: {fatherJob}</p>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white">۲. تحصیلات و سکونت</span>
                      <button type="button" onClick={() => setCurrentStep(2)} className="text-blue-600 flex items-center gap-1 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /> ویرایش
                      </button>
                    </div>
                    {educationList.map((e, i) => (
                      <p key={i}>تحصیلات: <strong>{e.degree_level} {e.major}</strong> ({e.university_name} - {e.study_city})</p>
                    ))}
                    <p>شهرستان و منطقه: <strong>{city} - {district}</strong></p>
                    <p>آدرس: {fullAddress}</p>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white">۳. بستگان و سوابق شغلی</span>
                      <button type="button" onClick={() => setCurrentStep(4)} className="text-blue-600 flex items-center gap-1 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /> ویرایش
                      </button>
                    </div>
                    {contactsList.map((c, i) => (
                      <p key={i} className="tabular-nums">بستگان: {c.full_name} ({c.relationship}) - {toPersianDigits(c.mobile)}</p>
                    ))}
                    <p>
                      سابقه شغلی: {hasWorkExperience ? `${toPersianDigits(workList.length)} مورد ثبت‌شده` : 'فاقد سابقه شغلی'}
                    </p>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white">۴. شرایط مالی و رزومه</span>
                      <button type="button" onClick={() => setCurrentStep(8)} className="text-blue-600 flex items-center gap-1 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /> ویرایش رزومه
                      </button>
                    </div>
                    <p>نحوه آشنایی: {acquaintanceSource}</p>
                    <p className="tabular-nums">حقوق پیشنهادی ماهانه: <strong>{formatToman(proposedSalaryToman)} تومان</strong></p>
                    <div>
                      <span className="text-slate-500 block mb-1">متن رزومه ثبت‌شده:</span>
                      <p className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 whitespace-pre-line leading-relaxed">
                        {resumeText.trim() ? resumeText : 'متن رزومه ثبت نشده است.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step Navigation Footer */}
            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>مرحله قبل</span>
              </button>

              {currentStep < 9 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <span>ذخیره و مرحله بعد</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleFinalSubmit}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isLoading ? 'در حال ثبت نهایی...' : 'تأیید و ثبت نهایی درخواست استخدام'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: APPLICANT TRACKING & RECEIPT */}
        {viewMode === 'TRACKING' && activeDossier && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    پرونده استخدامی: {activeDossier.full_name}
                  </h2>
                  <p className="text-xs text-slate-500 tabular-nums">
                    کد ملی: <strong className="text-blue-600 dark:text-blue-400">{toPersianDigits(activeDossier.national_code)}</strong> · شماره موبایل: <strong className="text-slate-700 dark:text-slate-300">{toPersianDigits(activeDossier.mobile)}</strong> · تاریخ ثبت: {toPersianDigits(activeDossier.submitted_at_jalali)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>دریافت رسید ثبت‌نام (PDF / چاپ)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationSmsNotice(false);
                    setViewMode('ENTRY');
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium cursor-pointer"
                >
                  بازگشت به صفحه اصلی
                </button>
              </div>
            </div>

            {registrationSmsNotice && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>
                  ثبت‌نام شما با موفقیت انجام شد و پیامک تایید ثبت‌نام به شماره موبایل{' '}
                  <strong className="tabular-nums">{toPersianDigits(activeDossier.mobile)}</strong> ارسال گردید.
                </span>
              </div>
            )}

            {/* Current Workflow Status Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 block mb-1">وضعیت فعلی درخواست در گردش کار:</span>
                <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  {activeDossier.status_title}
                </span>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 block mb-1">وضعیت تحویل مدارک حضوری:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeDossier.in_person_docs_status}
                </span>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 block mb-1">حقوق توافقی پیشنهادی شما:</span>
                <span className="text-sm font-bold tabular-nums">
                  {formatToman(activeDossier.proposed_salary_toman)} تومان
                </span>
              </div>
            </div>

            {/* Scheduled Interviews for this Applicant */}
            {activeDossier.interviews && activeDossier.interviews.length > 0 && (
              <div className="border border-blue-200 dark:border-blue-900 rounded-xl p-4 bg-blue-50/40 dark:bg-blue-950/20">
                <h3 className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>برنامه زمان‌بندی مصاحبه حضوری شما</span>
                </h3>
                {activeDossier.interviews.map((iv) => (
                  <div key={iv.id} className="text-xs space-y-1">
                    <p>
                      عنوان جلسه: <strong>{iv.stage_title}</strong> · وضعیت: <strong>{iv.status}</strong>
                    </p>
                    <p className="tabular-nums">
                      زمان برگزاری: <strong>{toPersianDigits(iv.interview_date_jalali)} ساعت {toPersianDigits(iv.interview_time)}</strong> · مکان: {iv.location}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Applicant-Visible Timeline */}
            <div>
              <h3 className="text-sm font-bold mb-3">تاریخچه پیگیری درخواست</h3>
              <div className="space-y-2.5">
                {activeDossier.timeline
                  .filter((ev) => ev.event_type !== 'INTERNAL_NOTE')
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-4 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{ev.title}</span>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">{ev.description}</p>
                      </div>
                      <span className="text-slate-400 tabular-nums shrink-0">{toPersianDigits(ev.event_date_jalali)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <PrintReportModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        mode="APPLICANT_RECEIPT"
        title="رسید رسمی ثبت درخواست استخدام شرکت دستوا"
        singleDossier={activeDossier}
        canViewEvaluations={false}
      />
    </div>
  );
};

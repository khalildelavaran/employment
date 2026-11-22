export type ApplicationStatusCode =
  | 'NEW_APPLICATION'
  | 'PENDING_REVIEW'
  | 'RESUME_REVIEWING'
  | 'INITIAL_QUALIFIED'
  | 'INVITED_TO_INTERVIEW'
  | 'INTERVIEW_COMPLETED'
  | 'PENDING_FINAL_DECISION'
  | 'FINAL_APPROVED'
  | 'REJECTED'
  | 'RESERVE_LIST'
  | 'APPLICANT_WITHDRAWN'
  | 'HIRED';

export type InPersonDocsStatus =
  | 'دریافت نشده'
  | 'دریافت مدارک به صورت حضوری'
  | 'مدارک بررسی شده'
  | 'مدارک ناقص'
  | 'نیازمند مراجعه مجدد';

export interface StatusInfo {
  code: ApplicationStatusCode;
  title: string;
  step_order: number;
  color_variant: 'blue' | 'amber' | 'indigo' | 'emerald' | 'purple' | 'rose' | 'slate';
  is_terminal: number;
}

export const APPLICATION_STATUS_LIST: StatusInfo[] = [
  { code: 'NEW_APPLICATION', title: 'ثبت درخواست جدید', step_order: 1, color_variant: 'blue', is_terminal: 0 },
  { code: 'PENDING_REVIEW', title: 'در انتظار بررسی', step_order: 2, color_variant: 'amber', is_terminal: 0 },
  { code: 'RESUME_REVIEWING', title: 'در حال بررسی رزومه', step_order: 3, color_variant: 'indigo', is_terminal: 0 },
  { code: 'INITIAL_QUALIFIED', title: 'واجد شرایط اولیه', step_order: 4, color_variant: 'blue', is_terminal: 0 },
  { code: 'INVITED_TO_INTERVIEW', title: 'دعوت به مصاحبه', step_order: 5, color_variant: 'purple', is_terminal: 0 },
  { code: 'INTERVIEW_COMPLETED', title: 'مصاحبه انجام شده', step_order: 6, color_variant: 'indigo', is_terminal: 0 },
  { code: 'PENDING_FINAL_DECISION', title: 'در انتظار تصمیم نهایی', step_order: 7, color_variant: 'amber', is_terminal: 0 },
  { code: 'FINAL_APPROVED', title: 'تأیید نهایی', step_order: 8, color_variant: 'emerald', is_terminal: 0 },
  { code: 'REJECTED', title: 'رد درخواست', step_order: 9, color_variant: 'rose', is_terminal: 1 },
  { code: 'RESERVE_LIST', title: 'ذخیره در فهرست متقاضیان جایگزین', step_order: 10, color_variant: 'slate', is_terminal: 0 },
  { code: 'APPLICANT_WITHDRAWN', title: 'انصراف متقاضی', step_order: 11, color_variant: 'slate', is_terminal: 1 },
  { code: 'HIRED', title: 'استخدام شده', step_order: 12, color_variant: 'emerald', is_terminal: 1 },
];

export const IN_PERSON_DOCS_STATUSES: InPersonDocsStatus[] = [
  'دریافت نشده',
  'دریافت مدارک به صورت حضوری',
  'مدارک بررسی شده',
  'مدارک ناقص',
  'نیازمند مراجعه مجدد',
];

export const DEGREE_LEVELS = [
  'دیپلم',
  'فوق دیپلم',
  'کارشناسی',
  'کارشناسی ارشد',
  'دکتری',
  'سایر',
] as const;

export const MILITARY_STATUS_OPTIONS = [
  'دارای کارت پایان خدمت',
  'معافیت دائم',
  'معافیت موقت',
  'در حال انجام خدمت',
  'مشمول',
  'سایر',
] as const;

export const ACQUAINTANCE_SOURCES = [
  'صفحه اینستاگرام شرکت دستوا',
  'از طریق دوستان',
  'آشنایان و فامیل',
  'گروه‌های درسی اساتید دانشگاه آزاد شوشتر',
  'گروه‌های اطلاع‌رسانی دانشگاه آزاد شوشتر',
  'صفحات و کانال‌های فضای مجازی',
  'سایر موارد',
] as const;

export const RELATIVE_RELATIONSHIPS = [
  'پدر',
  'مادر',
  'همسر',
  'خواهر',
  'برادر',
  'سایر',
] as const;

export interface EducationRecord {
  id?: number;
  major: string;
  degree_level: string;
  university_name: string;
  study_city: string;
  gpa?: string;
  graduation_year?: string;
}

export interface WorkExperienceRecord {
  id?: number;
  company_name: string;
  job_title: string;
  duration_text: string;
  duration_months: number;
  responsibilities: string;
  leaving_reason: string;
  is_relevant?: number;
}

export interface ContactRecord {
  id?: number;
  full_name: string;
  relationship: string;
  mobile: string;
}

export interface TimelineEventRecord {
  id: number;
  application_id: number;
  event_type: string;
  title: string;
  description: string;
  actor_name: string;
  previous_status: string;
  new_status: string;
  event_date_jalali: string;
}

export interface InternalNoteRecord {
  id: number;
  application_id: number;
  author_name: string;
  note_text: string;
  created_at_jalali: string;
}

export interface StatusHistoryRecord {
  id: number;
  application_id: number;
  previous_status_code: string;
  new_status_code: string;
  reason: string;
  changed_by_name: string;
  changed_at_jalali: string;
}

export interface InterviewRecord {
  id: number;
  application_id: number;
  applicant_full_name?: string;
  applicant_national_code?: string;
  applicant_mobile?: string;
  stage_number: number;
  stage_title: string;
  interview_date_jalali: string;
  interview_time: string;
  duration_minutes: number;
  location: string;
  interviewer_name: string;
  status: 'زمان‌بندی شده' | 'انجام شده' | 'تغییر زمان یافته' | 'لغو شده';
  description: string;
  result_summary: string;
  recommendation: string;
  overall_score: number;
  created_by_name: string;
  created_at_jalali: string;
}

export interface EvaluationCriterion {
  id: number;
  code: string;
  title: string;
  weight: number;
  max_score: number;
  category: string;
  is_active: number;
  display_order: number;
}

export interface EvaluationScoreItem {
  id?: number;
  criterion_id: number;
  criterion_title: string;
  score: number;
  max_score: number;
  weight: number;
  note: string;
}

export interface EvaluationRecord {
  id: number;
  application_id: number;
  interview_id: number | null;
  evaluation_type: 'RESUME_REVIEW' | 'INTERVIEW' | 'FINAL_ASSESSMENT';
  evaluator_name: string;
  total_weighted_score: number;
  strengths: string;
  weaknesses: string;
  general_comment: string;
  evaluated_at_jalali: string;
  scores: EvaluationScoreItem[];
}

export interface RecruitmentSettings {
  id: number;
  age_limit_enabled: number;
  female_min_age: number;
  female_max_age: number;
  male_min_age: number;
  male_max_age: number;
  allow_submit_without_resume: number;
  default_job_title: string;
  default_theme?: string;
  custom_theme?: Record<string, unknown>;
  company_districts: string[];
  settings_history: Array<{
    changed_at_jalali: string;
    changed_by: string;
    summary: string;
  }>;
  updated_by: string;
  updated_at_jalali: string;
}

export interface ApplicantSummaryRow {
  application_id: number;
  applicant_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  national_code: string;
  mobile: string;
  gender: 'زن' | 'مرد';
  birth_date_jalali: string;
  calculated_age: number;
  marital_status: 'مجرد' | 'متأهل' | 'مطلقه';
  military_status: string;
  father_name: string;
  father_alive_status: string;
  father_job: string;
  city: string;
  district: string;
  full_address: string;
  has_work_experience: number;
  resume_text: string;
  primary_major: string;
  primary_degree: string;
  primary_university: string;
  total_experience_months: number;
  acquaintance_source: string;
  proposed_salary_toman: number;
  status_code: ApplicationStatusCode;
  status_title: string;
  in_person_docs_status: InPersonDocsStatus;
  has_resume: boolean;
  avg_evaluation_score: number;
  avg_interview_score: number;
  is_age_qualified: boolean;
  age_warning_text: string;
  submitted_at_jalali: string;
  completion_percent: number;
  is_submitted: number;
  strengths_summary: string;
  weaknesses_summary: string;
}

export interface ApplicantFullDossier extends ApplicantSummaryRow {
  district_input_mode: 'list' | 'manual';
  acquaintance_note: string;
  current_step: number;
  in_person_docs_received_at_jalali: string;
  in_person_docs_by_user: string;
  in_person_docs_note: string;
  final_decision_note: string;
  final_decision_by: string;
  final_decision_at_jalali: string;
  education: EducationRecord[];
  work_experiences: WorkExperienceRecord[];
  contacts: ContactRecord[];
  timeline: TimelineEventRecord[];
  notes: InternalNoteRecord[];
  status_history: StatusHistoryRecord[];
  interviews: InterviewRecord[];
  evaluations: EvaluationRecord[];
}

export type SmsEventKey =
  | 'OTP'
  | 'REGISTRATION_SUCCESS'
  | 'STATUS_AND_INTERVIEW'
  | 'ADMIN_NEW_APPLICANT';

export type SmsSendMode = 'pattern' | 'text';

export interface SmsTemplateConfig {
  enabled: boolean;
  send_mode_override: 'default' | SmsSendMode;
  pattern_code: string;
  /** Maps FarazSMS pattern variable name -> recruitment variable name (e.g. { code: 'code' } or { name: 'name' }) */
  pattern_var_map: Record<string, string>;
  text_template: string;
}

export interface SmsSettingsConfig {
  sms_enabled: boolean;
  send_mode: SmsSendMode;
  line_number: string;
  number_format: 'persian' | 'english';
  admin_mobile: string;
  applicant_2fa_enabled: boolean;
  admin_2fa_enabled: boolean;
  otp_expiry_seconds: number;
  otp_resend_seconds: number;
  /** 0 = auto-detect tariff from FarazSMS balance_amount / balance_count; >0 = manual override in Toman per SMS page */
  unit_cost_toman: number;
  templates: Record<SmsEventKey, SmsTemplateConfig>;
  updated_at_jalali: string;
}

export interface SmsLogRecord {
  id: number;
  event_type: SmsEventKey | 'TEST_SMS' | (string & {});
  recipient_mobile: string;
  send_mode: SmsSendMode;
  line_number: string;
  pattern_code: string;
  message_text: string;
  status: 'sent' | 'failed' | 'skipped';
  provider_ref: string;
  provider_response: string;
  error_message: string;
  created_at_jalali: string;
}

export interface FarazLineItem {
  number: string;
  title?: string;
  is_dedicated?: boolean;
}

export interface FarazPatternItem {
  code: string;
  text: string;
  status?: string;
  vars?: string[];
}

export interface FarazProviderStatus {
  configured: boolean;
  connected: boolean;
  base_url: string;
  key_title: string;
  masked_key: string;
  balance_toman: number | null;
  balance_count?: number | null;
  derived_unit_cost_toman?: number | null;
  lines: FarazLineItem[];
  patterns: FarazPatternItem[];
  error?: string;
}

export type CustomSmsTriggerKey =
  | 'MANUAL_FOLLOWUP'
  | 'INTERVIEW_REMINDER'
  | 'DOCS_INCOMPLETE'
  | 'JOB_OFFER'
  | 'WELCOME_HIRED'
  | 'RESERVE_POOL'
  | 'CUSTOM';

export const CUSTOM_SMS_TRIGGER_OPTIONS: Array<{ key: CustomSmsTriggerKey; label: string }> = [
  { key: 'MANUAL_FOLLOWUP', label: 'پیگیری دستی متقاضی' },
  { key: 'INTERVIEW_REMINDER', label: 'یادآوری زمان مصاحبه حضوری' },
  { key: 'DOCS_INCOMPLETE', label: 'اطلاع‌رسانی نقص مدارک حضوری' },
  { key: 'JOB_OFFER', label: 'ارسال پیشنهاد همکاری و شرایط شغلی' },
  { key: 'WELCOME_HIRED', label: 'خوش‌آمدگویی شروع همکاری' },
  { key: 'RESERVE_POOL', label: 'ثبت در فهرست ذخیره و جایگزین' },
  { key: 'CUSTOM', label: 'سایر رویدادهای سفارشی' },
];

export interface CustomSmsTemplateRecord {
  id: number;
  title: string;
  trigger_key: CustomSmsTriggerKey;
  is_active: boolean;
  send_mode: SmsSendMode;
  pattern_code: string;
  pattern_var_map: Record<string, string>;
  text_template: string;
  created_at_jalali: string;
  updated_at_jalali: string;
}

export interface SmsLogsSummary {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  delivery_rate: number;
}

export interface SmsMonthlyAnalyticsPoint {
  month_key: string;
  month_label: string;
  total: number;
  sent: number;
  failed: number;
  pages: number;
  spend_toman: number;
}

export interface SmsEventAnalyticsPoint {
  event_type: string;
  label: string;
  total: number;
  sent: number;
  failed: number;
  pages: number;
  spend_toman: number;
}

export interface SmsModeAnalyticsPoint {
  mode: SmsSendMode;
  label: string;
  total: number;
  sent: number;
  failed: number;
}

export interface SmsAnalyticsData {
  overview: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    delivery_rate: number;
    total_pages: number;
    total_spend_toman: number;
    current_month_label: string;
    current_month_sent: number;
    current_month_pages: number;
    current_month_spend_toman: number;
    effective_unit_cost_toman: number;
    tariff_source: 'manual' | 'auto' | 'fallback';
    auto_unit_cost_toman: number | null;
    manual_unit_cost_toman: number;
  };
  monthly_trend: SmsMonthlyAnalyticsPoint[];
  by_event: SmsEventAnalyticsPoint[];
  by_mode: SmsModeAnalyticsPoint[];
}




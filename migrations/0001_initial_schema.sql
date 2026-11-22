-- =============================================================================
-- Migration: 0001_initial_schema.sql
-- System: Dasteva Comprehensive Recruitment System
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. users (Single System Administrator)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  preferred_theme TEXT NOT NULL DEFAULT 'azure-professional',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. applicants (Single source of truth for applicant identity, residence, and resume_text)
CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  national_code TEXT NOT NULL UNIQUE,
  gender TEXT NOT NULL CHECK (gender IN ('زن', 'مرد')),
  birth_date_jalali TEXT NOT NULL,
  birth_year_jalali INTEGER NOT NULL,
  calculated_age INTEGER NOT NULL,
  marital_status TEXT NOT NULL CHECK (marital_status IN ('مجرد', 'متأهل', 'مطلقه')),
  military_status TEXT,
  father_name TEXT NOT NULL,
  father_alive_status TEXT NOT NULL CHECK (father_alive_status IN ('در قید حیات', 'در قید حیات نیستند')),
  father_job TEXT NOT NULL,
  mobile TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  district_input_mode TEXT NOT NULL DEFAULT 'list' CHECK (district_input_mode IN ('list', 'manual')),
  full_address TEXT NOT NULL DEFAULT '',
  has_work_experience INTEGER NOT NULL DEFAULT 0,
  resume_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applicants_national_code ON applicants(national_code);
CREATE INDEX IF NOT EXISTS idx_applicants_mobile ON applicants(mobile);
CREATE INDEX IF NOT EXISTS idx_applicants_name ON applicants(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_applicants_filter ON applicants(gender, calculated_age, marital_status, city);

-- 3. applicant_education (1:N relationship)
CREATE TABLE IF NOT EXISTS applicant_education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  major TEXT NOT NULL,
  degree_level TEXT NOT NULL CHECK (degree_level IN ('دیپلم', 'فوق دیپلم', 'کارشناسی', 'کارشناسی ارشد', 'دکتری', 'سایر')),
  university_name TEXT NOT NULL,
  study_city TEXT NOT NULL,
  gpa TEXT,
  graduation_year TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_education_applicant ON applicant_education(applicant_id);
CREATE INDEX IF NOT EXISTS idx_education_degree ON applicant_education(degree_level);

-- 4. applicant_work_experiences (1:N relationship)
CREATE TABLE IF NOT EXISTS applicant_work_experiences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  duration_text TEXT NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 0,
  responsibilities TEXT NOT NULL,
  leaving_reason TEXT NOT NULL,
  is_relevant INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_applicant ON applicant_work_experiences(applicant_id);

-- 5. applicant_contacts (Relatives & References 1:N)
CREATE TABLE IF NOT EXISTS applicant_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('پدر', 'مادر', 'همسر', 'خواهر', 'برادر', 'سایر')),
  mobile TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_applicant ON applicant_contacts(applicant_id);

-- 6. recruitment_settings (Configurable age rules, default theme, and settings history)
CREATE TABLE IF NOT EXISTS recruitment_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age_limit_enabled INTEGER NOT NULL DEFAULT 1,
  female_min_age INTEGER NOT NULL DEFAULT 20,
  female_max_age INTEGER NOT NULL DEFAULT 35,
  male_min_age INTEGER NOT NULL DEFAULT 22,
  male_max_age INTEGER NOT NULL DEFAULT 38,
  allow_submit_without_resume INTEGER NOT NULL DEFAULT 0,
  default_job_title TEXT NOT NULL DEFAULT 'کارمند اداری و دفتری (ساعت ۸ الی ۱۴)',
  default_theme TEXT NOT NULL DEFAULT 'azure-professional',
  custom_theme_json TEXT NOT NULL DEFAULT '{}',
  company_districts_json TEXT NOT NULL DEFAULT '["مرکز شهر", "فرهنگیان", "کوی نیرو", "دروازه", "دولت‌آباد", "کوی بوستان", "سایر مناطق"]',
  settings_history_json TEXT NOT NULL DEFAULT '[]',
  updated_by TEXT NOT NULL DEFAULT 'مدیر سامانه',
  updated_at_jalali TEXT NOT NULL DEFAULT '۱۴۰۵/۰۸/۲۵ - ۱۰:۰۰'
);

-- 7. application_statuses (12 standard workflow statuses)
CREATE TABLE IF NOT EXISTS application_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  color_variant TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0
);

-- 8. recruitment_applications (Unified recruitment file per applicant)
CREATE TABLE IF NOT EXISTS recruitment_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL UNIQUE,
  status_code TEXT NOT NULL DEFAULT 'NEW_APPLICATION',
  current_step INTEGER NOT NULL DEFAULT 1,
  completion_percent INTEGER NOT NULL DEFAULT 15,
  is_submitted INTEGER NOT NULL DEFAULT 0,
  acquaintance_source TEXT NOT NULL DEFAULT '',
  acquaintance_note TEXT NOT NULL DEFAULT '',
  proposed_salary_toman INTEGER NOT NULL DEFAULT 0,
  in_person_docs_status TEXT NOT NULL DEFAULT 'دریافت نشده' CHECK (
    in_person_docs_status IN (
      'دریافت نشده',
      'دریافت مدارک به صورت حضوری',
      'مدارک بررسی شده',
      'مدارک ناقص',
      'نیازمند مراجعه مجدد'
    )
  ),
  in_person_docs_received_at_jalali TEXT DEFAULT '',
  in_person_docs_by_user TEXT DEFAULT '',
  in_person_docs_note TEXT DEFAULT '',
  final_decision_note TEXT DEFAULT '',
  final_decision_by TEXT DEFAULT '',
  final_decision_at_jalali TEXT DEFAULT '',
  strengths_summary TEXT DEFAULT '',
  weaknesses_summary TEXT DEFAULT '',
  submitted_at_jalali TEXT NOT NULL DEFAULT '',
  created_at_jalali TEXT NOT NULL DEFAULT '',
  updated_at_jalali TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  FOREIGN KEY (status_code) REFERENCES application_statuses(code)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON recruitment_applications(status_code);

-- 9. application_status_history (Immutable status change history)
CREATE TABLE IF NOT EXISTS application_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  previous_status_code TEXT,
  new_status_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  changed_at_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES recruitment_applications(id) ON DELETE CASCADE
);

-- 10. application_notes (Internal management notes - hidden from applicant)
CREATE TABLE IF NOT EXISTS application_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  note_text TEXT NOT NULL,
  is_confidential INTEGER NOT NULL DEFAULT 1,
  created_at_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES recruitment_applications(id) ON DELETE CASCADE
);

-- 11. interviews (Supports multiple interview stages per applicant & time conflict detection)
CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  stage_number INTEGER NOT NULL DEFAULT 1,
  stage_title TEXT NOT NULL DEFAULT 'مصاحبه استخدامی',
  interview_date_jalali TEXT NOT NULL,
  interview_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  location TEXT NOT NULL,
  interviewer_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  status TEXT NOT NULL DEFAULT 'زمان‌بندی شده' CHECK (
    status IN ('زمان‌بندی شده', 'انجام شده', 'تغییر زمان یافته', 'لغو شده')
  ),
  description TEXT DEFAULT '',
  result_summary TEXT DEFAULT '',
  recommendation TEXT DEFAULT '',
  overall_score REAL DEFAULT 0,
  created_by_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  created_at_jalali TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES recruitment_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interviews_schedule ON interviews(interview_date_jalali, interview_time);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);

-- 12. evaluation_criteria (8 configurable criteria & weights)
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 10,
  max_score INTEGER NOT NULL DEFAULT 10,
  category TEXT NOT NULL DEFAULT 'INTERVIEW',
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1
);

-- 13. interview_evaluations (Evaluation header per interview or review)
CREATE TABLE IF NOT EXISTS interview_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  interview_id INTEGER,
  evaluation_type TEXT NOT NULL DEFAULT 'INTERVIEW' CHECK (evaluation_type IN ('RESUME_REVIEW', 'INTERVIEW', 'FINAL_ASSESSMENT')),
  evaluator_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  total_weighted_score REAL NOT NULL DEFAULT 0,
  strengths TEXT DEFAULT '',
  weaknesses TEXT DEFAULT '',
  general_comment TEXT DEFAULT '',
  evaluated_at_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES recruitment_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE SET NULL
);

-- 14. evaluation_scores (Detailed score per criterion)
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  criterion_title TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL DEFAULT 10,
  weight INTEGER NOT NULL DEFAULT 10,
  note TEXT DEFAULT '',
  FOREIGN KEY (evaluation_id) REFERENCES interview_evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id)
);

-- 15. recruitment_events (Immutable unified timeline log per application)
CREATE TABLE IF NOT EXISTS recruitment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  previous_status TEXT DEFAULT '',
  new_status TEXT DEFAULT '',
  event_date_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES recruitment_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_application ON recruitment_events(application_id);

-- 16. audit_logs (System-wide security and operation logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL DEFAULT 'مدیر سامانه',
  action_type TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '127.0.0.1',
  created_at_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. sms_settings (Singleton FarazSMS / IranPayamak configuration & templates)
CREATE TABLE IF NOT EXISTS sms_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sms_enabled INTEGER NOT NULL DEFAULT 1,
  send_mode TEXT NOT NULL DEFAULT 'pattern' CHECK (send_mode IN ('pattern', 'text')),
  line_number TEXT NOT NULL DEFAULT '',
  number_format TEXT NOT NULL DEFAULT 'persian' CHECK (number_format IN ('persian', 'english')),
  admin_mobile TEXT NOT NULL DEFAULT '',
  applicant_2fa_enabled INTEGER NOT NULL DEFAULT 1,
  admin_2fa_enabled INTEGER NOT NULL DEFAULT 0,
  otp_expiry_seconds INTEGER NOT NULL DEFAULT 120,
  otp_resend_seconds INTEGER NOT NULL DEFAULT 60,
  unit_cost_toman REAL NOT NULL DEFAULT 0,
  templates_json TEXT NOT NULL DEFAULT '{}',
  updated_at_jalali TEXT NOT NULL DEFAULT ''
);

-- 18. otp_verifications (Server-side 2FA OTP challenges for applicants & admin)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('APPLICANT_ENTRY', 'ADMIN_LOGIN')),
  mobile TEXT NOT NULL,
  national_code TEXT DEFAULT '',
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_challenge ON otp_verifications(challenge_id);
CREATE INDEX IF NOT EXISTS idx_otp_mobile_purpose ON otp_verifications(mobile, purpose);

-- 19. sms_logs (Complete delivery & audit log for FarazSMS API dispatches)
CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  recipient_mobile TEXT NOT NULL,
  send_mode TEXT NOT NULL,
  line_number TEXT DEFAULT '',
  pattern_code TEXT DEFAULT '',
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_ref TEXT DEFAULT '',
  provider_response TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  created_at_jalali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_event ON sms_logs(event_type);

-- 20. sms_custom_templates (Admin CRUD custom SMS patterns & plain-text templates)
CREATE TABLE IF NOT EXISTS sms_custom_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  trigger_key TEXT NOT NULL DEFAULT 'MANUAL_FOLLOWUP',
  is_active INTEGER NOT NULL DEFAULT 1,
  send_mode TEXT NOT NULL DEFAULT 'text' CHECK (send_mode IN ('pattern', 'text')),
  pattern_code TEXT NOT NULL DEFAULT '',
  pattern_var_map_json TEXT NOT NULL DEFAULT '{}',
  text_template TEXT NOT NULL,
  created_at_jalali TEXT NOT NULL DEFAULT '',
  updated_at_jalali TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_custom_templates_trigger ON sms_custom_templates(trigger_key);



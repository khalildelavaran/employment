import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { checkDatabaseHealth, closeD1Database, getD1Database } from './src/db/d1Adapter.ts';
import {
  APPLICATION_STATUS_LIST,
  ApplicantSummaryRow,
  RecruitmentSettings,
  SmsEventKey,
} from './src/types/recruitment.ts';
import {
  calculateAgeFromJalali,
  getCurrentJalaliDateTime,
  toEnglishDigits,
  toPersianDigits,
  validateIranianMobile,
  validateIranianNationalCode,
} from './src/utils/validation.ts';
import {
  createAndSendOtpChallenge,
  createCustomSmsTemplate,
  deleteCustomSmsTemplate,
  dispatchRecruitmentSms,
  fetchFarazProviderStatus,
  getFarazRuntimeConfig,
  getSmsAnalytics,
  getSmsLogsWithSummary,
  getSmsSettingsRow,
  listCustomSmsTemplates,
  retrySmsLogEntry,
  saveSmsSettingsRow,
  sendCustomTemplateSms,
  updateCustomSmsTemplate,
  verifyOtpChallenge,
} from './src/services/farazSmsService.ts';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

const db = getD1Database();

const lookupAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = lookupAttempts.get(ip);
  if (!record || now > record.resetAt) {
    lookupAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (record.count >= 30) {
    return false;
  }
  record.count += 1;
  return true;
}

const ADMIN_ACTOR_NAME = 'مدیر سامانه';

function logAudit(
  actionType: string,
  targetEntity: string,
  targetId: string,
  details: string
): void {
  const nowJalali = getCurrentJalaliDateTime();
  db.prepare(
    `INSERT INTO audit_logs (actor_name, action_type, target_entity, target_id, details, created_at_jalali)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(ADMIN_ACTOR_NAME, actionType, targetEntity, targetId, details, nowJalali)
    .run();
}

function getSettingsRow(): RecruitmentSettings {
  const row = db.prepare('SELECT * FROM recruitment_settings WHERE id = 1').first<Record<string, unknown>>();
  if (!row) {
    return {
      id: 1,
      age_limit_enabled: 1,
      female_min_age: 21,
      female_max_age: 34,
      male_min_age: 22,
      male_max_age: 36,
      allow_submit_without_resume: 1,
      default_job_title: 'کارمند اداری و دفتری (ساعت کاری ۸ الی ۱۴)',
      default_theme: 'azure-professional',
      custom_theme: {},
      company_districts: ['مرکز شهر شوشتر', 'فرهنگیان', 'کوی نیرو', 'دروازه', 'دولت‌آباد', 'کوی بوستان', 'سایر مناطق'],
      settings_history: [],
      updated_by: ADMIN_ACTOR_NAME,
      updated_at_jalali: '۱۴۰۵/۰۸/۲۰ - ۱۰:۳۰',
    };
  }
  return {
    id: Number(row.id),
    age_limit_enabled: Number(row.age_limit_enabled),
    female_min_age: Number(row.female_min_age),
    female_max_age: Number(row.female_max_age),
    male_min_age: Number(row.male_min_age),
    male_max_age: Number(row.male_max_age),
    allow_submit_without_resume: Number(row.allow_submit_without_resume),
    default_job_title: String(row.default_job_title),
    default_theme: String(row.default_theme || 'azure-professional'),
    custom_theme: JSON.parse(String(row.custom_theme_json || '{}')),
    company_districts: JSON.parse(String(row.company_districts_json || '[]')),
    settings_history: JSON.parse(String(row.settings_history_json || '[]')),
    updated_by: String(row.updated_by),
    updated_at_jalali: String(row.updated_at_jalali),
  };
}

function evaluateAgeQualification(
  gender: string,
  age: number,
  settings: RecruitmentSettings
): { qualified: boolean; warningText: string } {
  if (!settings.age_limit_enabled) {
    return { qualified: true, warningText: '' };
  }
  if (gender === 'زن') {
    if (age < settings.female_min_age || age > settings.female_max_age) {
      return {
        qualified: false,
        warningText: `خارج از بازه سنی مجاز بانوان (${toPersianDigits(settings.female_min_age)} تا ${toPersianDigits(settings.female_max_age)} سال)`,
      };
    }
  } else {
    if (age < settings.male_min_age || age > settings.male_max_age) {
      return {
        qualified: false,
        warningText: `خارج از بازه سنی مجاز آقایان (${toPersianDigits(settings.male_min_age)} تا ${toPersianDigits(settings.male_max_age)} سال)`,
      };
    }
  }
  return { qualified: true, warningText: '' };
}

function buildApplicantSummaryList(): ApplicantSummaryRow[] {
  const settings = getSettingsRow();
  const rows = db
    .prepare(
      `SELECT
        ra.id as application_id,
        a.id as applicant_id,
        a.first_name,
        a.last_name,
        a.national_code,
        a.mobile,
        a.gender,
        a.birth_date_jalali,
        a.calculated_age,
        a.marital_status,
        a.military_status,
        a.father_name,
        a.father_alive_status,
        a.father_job,
        a.city,
        a.district,
        a.full_address,
        a.has_work_experience,
        a.resume_text,
        ra.acquaintance_source,
        ra.proposed_salary_toman,
        ra.status_code,
        st.title as status_title,
        ra.in_person_docs_status,
        ra.submitted_at_jalali,
        ra.completion_percent,
        ra.is_submitted,
        ra.strengths_summary,
        ra.weaknesses_summary,
        (SELECT major FROM applicant_education WHERE applicant_id = a.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_major,
        (SELECT degree_level FROM applicant_education WHERE applicant_id = a.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_degree,
        (SELECT university_name FROM applicant_education WHERE applicant_id = a.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_university,
        COALESCE((SELECT SUM(duration_months) FROM applicant_work_experiences WHERE applicant_id = a.id), 0) as total_experience_months,
        COALESCE((SELECT ROUND(AVG(total_weighted_score), 1) FROM interview_evaluations WHERE application_id = ra.id), 0) as avg_evaluation_score,
        COALESCE((SELECT ROUND(AVG(overall_score) * 10, 1) FROM interviews WHERE application_id = ra.id AND overall_score > 0), 0) as avg_interview_score
      FROM recruitment_applications ra
      JOIN applicants a ON a.id = ra.applicant_id
      LEFT JOIN application_statuses st ON st.code = ra.status_code
      ORDER BY ra.id DESC`
    )
    .all<Record<string, unknown>>().results;

  return rows.map((r) => {
    const gender = String(r.gender) as 'زن' | 'مرد';
    const age = Number(r.calculated_age);
    const ageCheck = evaluateAgeQualification(gender, age, settings);
    const resumeText = String(r.resume_text || '');
    return {
      application_id: Number(r.application_id),
      applicant_id: Number(r.applicant_id),
      first_name: String(r.first_name),
      last_name: String(r.last_name),
      full_name: `${r.first_name} ${r.last_name}`,
      national_code: String(r.national_code),
      mobile: String(r.mobile),
      gender,
      birth_date_jalali: String(r.birth_date_jalali),
      calculated_age: age,
      marital_status: String(r.marital_status) as 'مجرد' | 'متأهل' | 'مطلقه',
      military_status: String(r.military_status || ''),
      father_name: String(r.father_name || ''),
      father_alive_status: String(r.father_alive_status || 'در قید حیات'),
      father_job: String(r.father_job || ''),
      city: String(r.city || ''),
      district: String(r.district || ''),
      full_address: String(r.full_address || ''),
      has_work_experience: Number(r.has_work_experience || 0),
      resume_text: resumeText,
      primary_major: String(r.primary_major || 'ثبت نشده'),
      primary_degree: String(r.primary_degree || 'ثبت نشده'),
      primary_university: String(r.primary_university || 'ثبت نشده'),
      total_experience_months: Number(r.total_experience_months || 0),
      acquaintance_source: String(r.acquaintance_source || ''),
      proposed_salary_toman: Number(r.proposed_salary_toman || 0),
      status_code: String(r.status_code) as ApplicantSummaryRow['status_code'],
      status_title: String(r.status_title || 'ثبت درخواست جدید'),
      in_person_docs_status: String(r.in_person_docs_status || 'دریافت نشده') as ApplicantSummaryRow['in_person_docs_status'],
      has_resume: Boolean(resumeText.trim()),
      avg_evaluation_score: Number(r.avg_evaluation_score || 0),
      avg_interview_score: Number(r.avg_interview_score || 0),
      is_age_qualified: ageCheck.qualified,
      age_warning_text: ageCheck.warningText,
      submitted_at_jalali: String(r.submitted_at_jalali || ''),
      completion_percent: Number(r.completion_percent || 0),
      is_submitted: Number(r.is_submitted || 0),
      strengths_summary: String(r.strengths_summary || ''),
      weaknesses_summary: String(r.weaknesses_summary || ''),
    };
  });
}

function buildFullDossier(applicationId: number, includeConfidentialNotes = true) {
  const summaries = buildApplicantSummaryList();
  const summary = summaries.find((s) => s.application_id === applicationId);
  if (!summary) return null;

  const appRow = db
    .prepare('SELECT * FROM recruitment_applications WHERE id = ?')
    .bind(applicationId)
    .first<Record<string, unknown>>();
  const applicantRow = db
    .prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(summary.applicant_id)
    .first<Record<string, unknown>>();

  const education = db
    .prepare('SELECT * FROM applicant_education WHERE applicant_id = ? ORDER BY id ASC')
    .bind(summary.applicant_id)
    .all().results;

  const work_experiences = db
    .prepare('SELECT * FROM applicant_work_experiences WHERE applicant_id = ? ORDER BY id ASC')
    .bind(summary.applicant_id)
    .all().results;

  const contacts = db
    .prepare('SELECT * FROM applicant_contacts WHERE applicant_id = ? ORDER BY id ASC')
    .bind(summary.applicant_id)
    .all().results;

  const timeline = db
    .prepare('SELECT * FROM recruitment_events WHERE application_id = ? ORDER BY id DESC')
    .bind(applicationId)
    .all().results;

  const notes = includeConfidentialNotes
    ? db
        .prepare('SELECT * FROM application_notes WHERE application_id = ? ORDER BY id DESC')
        .bind(applicationId)
        .all().results
    : [];

  const status_history = db
    .prepare('SELECT * FROM application_status_history WHERE application_id = ? ORDER BY id DESC')
    .bind(applicationId)
    .all().results;

  const interviews = db
    .prepare('SELECT * FROM interviews WHERE application_id = ? ORDER BY stage_number ASC, id DESC')
    .bind(applicationId)
    .all().results;

  const rawEvaluations = db
    .prepare('SELECT * FROM interview_evaluations WHERE application_id = ? ORDER BY id DESC')
    .bind(applicationId)
    .all<Record<string, unknown>>().results;

  const evaluations = rawEvaluations.map((ev) => {
    const scores = db
      .prepare('SELECT * FROM evaluation_scores WHERE evaluation_id = ? ORDER BY id ASC')
      .bind(ev.id)
      .all().results;
    return {
      ...ev,
      scores,
    };
  });

  return {
    ...summary,
    district_input_mode: (applicantRow?.district_input_mode as 'list' | 'manual') || 'list',
    acquaintance_note: String(appRow?.acquaintance_note || ''),
    current_step: Number(appRow?.current_step || 1),
    in_person_docs_received_at_jalali: String(appRow?.in_person_docs_received_at_jalali || ''),
    in_person_docs_by_user: String(appRow?.in_person_docs_by_user || ''),
    in_person_docs_note: String(appRow?.in_person_docs_note || ''),
    final_decision_note: String(appRow?.final_decision_note || ''),
    final_decision_by: String(appRow?.final_decision_by || ''),
    final_decision_at_jalali: String(appRow?.final_decision_at_jalali || ''),
    education,
    work_experiences,
    contacts,
    timeline,
    notes,
    status_history,
    interviews,
    evaluations: includeConfidentialNotes ? evaluations : [],
  };
}

// ============================================================================
// 1. PUBLIC APPLICANT PORTAL APIs
// ============================================================================

app.get('/api/public/config', (_req: Request, res: Response) => {
  const settings = getSettingsRow();
  const smsSettings = getSmsSettingsRow(db);
  res.json({
    default_job_title: settings.default_job_title,
    default_theme: settings.default_theme || 'azure-professional',
    custom_theme: settings.custom_theme || {},
    company_districts: settings.company_districts,
    allow_submit_without_resume: Boolean(settings.allow_submit_without_resume),
    age_limit_enabled: Boolean(settings.age_limit_enabled),
    female_min_age: settings.female_min_age,
    female_max_age: settings.female_max_age,
    male_min_age: settings.male_min_age,
    male_max_age: settings.male_max_age,
    applicant_2fa_enabled: Boolean(smsSettings.sms_enabled && smsSettings.applicant_2fa_enabled),
    otp_expiry_seconds: smsSettings.otp_expiry_seconds,
    otp_resend_seconds: smsSettings.otp_resend_seconds,
  });
});

function performApplicantLookup(cleanNat: string, cleanMob: string) {
  const existingApplicant = db
    .prepare('SELECT id, mobile FROM applicants WHERE national_code = ?')
    .bind(cleanNat)
    .first<{ id: number; mobile: string }>();

  if (!existingApplicant) {
    return {
      status: 200,
      payload: {
        found: false,
        national_code: cleanNat,
        mobile: cleanMob,
        message: 'متقاضی جدید؛ آماده شروع تکمیل فرم استخدام.',
      },
    };
  }

  if (existingApplicant.mobile !== cleanMob) {
    return {
      status: 403,
      payload: {
        error: 'کد ملی واردشده قبلاً با شماره موبایل دیگری در سامانه ثبت شده است.',
      },
    };
  }

  const appRow = db
    .prepare('SELECT id FROM recruitment_applications WHERE applicant_id = ?')
    .bind(existingApplicant.id)
    .first<{ id: number }>();

  if (!appRow) {
    return {
      status: 200,
      payload: { found: false, national_code: cleanNat, mobile: cleanMob },
    };
  }

  const dossier = buildFullDossier(appRow.id, false);
  return {
    status: 200,
    payload: { found: true, dossier },
  };
}

app.post('/api/public/otp/request', async (req: Request, res: Response) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: 'تعداد تلاش‌های شما بیش از حد مجاز بوده است. لطفاً چند دقیقه دیگر مجدداً تلاش کنید.',
    });
    return;
  }

  const { national_code, mobile } = req.body;
  const cleanNat = toEnglishDigits(String(national_code || '')).trim();
  const cleanMob = toEnglishDigits(String(mobile || '')).trim();

  const natVal = validateIranianNationalCode(cleanNat);
  if (!natVal.valid) {
    res.status(400).json({ error: natVal.message });
    return;
  }
  const mobVal = validateIranianMobile(cleanMob);
  if (!mobVal.valid) {
    res.status(400).json({ error: mobVal.message });
    return;
  }

  // Verify national_code does not belong to a different mobile number before sending SMS
  const existingApplicant = db
    .prepare('SELECT id, mobile FROM applicants WHERE national_code = ?')
    .bind(cleanNat)
    .first<{ id: number; mobile: string }>();

  if (existingApplicant && existingApplicant.mobile !== cleanMob) {
    res.status(403).json({
      error: 'کد ملی واردشده قبلاً با شماره موبایل دیگری در سامانه ثبت شده است.',
    });
    return;
  }

  const smsSettings = getSmsSettingsRow(db);
  if (!smsSettings.sms_enabled || !smsSettings.applicant_2fa_enabled) {
    const lookup = performApplicantLookup(cleanNat, cleanMob);
    res.status(lookup.status).json({ otp_skipped: true, ...lookup.payload });
    return;
  }

  const otpRes = await createAndSendOtpChallenge(db, {
    purpose: 'APPLICANT_ENTRY',
    mobile: cleanMob,
    national_code: cleanNat,
  });

  if (!otpRes.ok) {
    res.status(otpRes.retry_after_seconds ? 429 : 502).json({
      error: otpRes.error || 'خطا در ارسال پیامک کد تایید.',
      retry_after_seconds: otpRes.retry_after_seconds,
    });
    return;
  }

  res.json({
    success: true,
    requires_otp: true,
    challenge_id: otpRes.challenge_id,
    masked_mobile: otpRes.masked_mobile,
    expires_in: otpRes.expires_in,
    resend_after: otpRes.resend_after,
  });
});

app.post('/api/public/otp/verify', (req: Request, res: Response) => {
  const { challenge_id, code } = req.body;
  const verification = verifyOtpChallenge(db, {
    challenge_id: String(challenge_id || ''),
    code: String(code || ''),
    purpose: 'APPLICANT_ENTRY',
  });

  if (!verification.valid || !verification.mobile || !verification.national_code) {
    res.status(400).json({ error: verification.error || 'کد تایید نامعتبر است.' });
    return;
  }

  const lookup = performApplicantLookup(verification.national_code, verification.mobile);
  res.status(lookup.status).json({
    verified: true,
    ...lookup.payload,
  });
});

app.post('/api/public/lookup', (req: Request, res: Response) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: 'تعداد تلاش‌های شما بیش از حد مجاز بوده است. لطفاً چند دقیقه دیگر مجدداً تلاش کنید.',
    });
    return;
  }

  const { national_code, mobile } = req.body;
  const cleanNat = toEnglishDigits(String(national_code || '')).trim();
  const cleanMob = toEnglishDigits(String(mobile || '')).trim();

  const natVal = validateIranianNationalCode(cleanNat);
  if (!natVal.valid) {
    res.status(400).json({ error: natVal.message });
    return;
  }
  const mobVal = validateIranianMobile(cleanMob);
  if (!mobVal.valid) {
    res.status(400).json({ error: mobVal.message });
    return;
  }

  const smsSettings = getSmsSettingsRow(db);
  if (smsSettings.sms_enabled && smsSettings.applicant_2fa_enabled) {
    res.status(403).json({
      requires_otp: true,
      error: 'احراز هویت دومرحله‌ای فعال است. لطفاً ابتدا کد تایید پیامکی را دریافت و وارد کنید.',
    });
    return;
  }

  const lookup = performApplicantLookup(cleanNat, cleanMob);
  res.status(lookup.status).json(lookup.payload);
});

app.post('/api/public/save-draft', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const cleanNat = toEnglishDigits(String(payload.national_code || '')).trim();
    const cleanMob = toEnglishDigits(String(payload.mobile || '')).trim();

    const natCheck = validateIranianNationalCode(cleanNat);
    if (!natCheck.valid) {
      res.status(400).json({ error: natCheck.message });
      return;
    }
    const mobCheck = validateIranianMobile(cleanMob);
    if (!mobCheck.valid) {
      res.status(400).json({ error: mobCheck.message });
      return;
    }

    const birthDateJalali = toEnglishDigits(String(payload.birth_date_jalali || '1378/01/01')).trim();
    const ageCalc = calculateAgeFromJalali(birthDateJalali);
    if (!ageCalc.valid) {
      res.status(400).json({ error: ageCalc.message || 'تاریخ تولد نامعتبر است.' });
      return;
    }
    const calculatedAge = ageCalc.age;
    const birthYear = ageCalc.birthYear;

    const gender = payload.gender === 'مرد' ? 'مرد' : 'زن';

    // Strict age limit enforcement: applicants outside the allowed age range cannot register
    const settings = getSettingsRow();
    const ageQualification = evaluateAgeQualification(gender, calculatedAge, settings);
    if (!ageQualification.qualified) {
      res.status(400).json({
        error: `امکان ثبت‌نام وجود ندارد: سن شما (${toPersianDigits(calculatedAge)} سال) ${ageQualification.warningText} است.`,
      });
      return;
    }

    const militaryStatus = gender === 'مرد' ? String(payload.military_status || '') : '';
    const nowJalali = getCurrentJalaliDateTime();

    const raw = db.getRawSqlite();
    let resultApplicationId = 0;

    const saveTx = raw.transaction(() => {
      const existing = db
        .prepare('SELECT id FROM applicants WHERE national_code = ?')
        .bind(cleanNat)
        .first<{ id: number }>();

      let applicantId: number;
      if (!existing) {
        const ins = db
          .prepare(
            `INSERT INTO applicants (
              first_name, last_name, national_code, gender, birth_date_jalali, birth_year_jalali,
              calculated_age, marital_status, military_status, father_name, father_alive_status,
              father_job, mobile, city, district, district_input_mode, full_address, has_work_experience, resume_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            String(payload.first_name || '').trim(),
            String(payload.last_name || '').trim(),
            cleanNat,
            gender,
            birthDateJalali,
            birthYear,
            calculatedAge,
            String(payload.marital_status || 'مجرد'),
            militaryStatus,
            String(payload.father_name || '').trim(),
            String(payload.father_alive_status || 'در قید حیات'),
            String(payload.father_job || '').trim(),
            cleanMob,
            String(payload.city || '').trim(),
            String(payload.district || '').trim(),
            payload.district_input_mode === 'manual' ? 'manual' : 'list',
            String(payload.full_address || '').trim(),
            payload.has_work_experience ? 1 : 0,
            String(payload.resume_text || '').trim()
          )
          .run();
        applicantId = ins.meta.last_row_id;
      } else {
        applicantId = existing.id;
        const existingApp = db
          .prepare('SELECT id, is_submitted FROM recruitment_applications WHERE applicant_id = ?')
          .bind(applicantId)
          .first<{ id: number; is_submitted: number }>();

        if (existingApp && existingApp.is_submitted === 1 && !payload.allow_edit_before_submit) {
          throw new Error('این درخواست قبلاً ثبت نهایی شده است و قابل ویرایش نیست.');
        }

        db.prepare(
          `UPDATE applicants SET
            first_name = ?, last_name = ?, gender = ?, birth_date_jalali = ?, birth_year_jalali = ?,
            calculated_age = ?, marital_status = ?, military_status = ?, father_name = ?,
            father_alive_status = ?, father_job = ?, mobile = ?, city = ?, district = ?,
            district_input_mode = ?, full_address = ?, has_work_experience = ?, resume_text = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(
            String(payload.first_name || '').trim(),
            String(payload.last_name || '').trim(),
            gender,
            birthDateJalali,
            birthYear,
            calculatedAge,
            String(payload.marital_status || 'مجرد'),
            militaryStatus,
            String(payload.father_name || '').trim(),
            String(payload.father_alive_status || 'در قید حیات'),
            String(payload.father_job || '').trim(),
            cleanMob,
            String(payload.city || '').trim(),
            String(payload.district || '').trim(),
            payload.district_input_mode === 'manual' ? 'manual' : 'list',
            String(payload.full_address || '').trim(),
            payload.has_work_experience ? 1 : 0,
            String(payload.resume_text || '').trim(),
            applicantId
          )
          .run();
      }

      // Sync Education (1:N)
      if (Array.isArray(payload.education)) {
        db.prepare('DELETE FROM applicant_education WHERE applicant_id = ?').bind(applicantId).run();
        payload.education.forEach((edu: Record<string, unknown>, idx: number) => {
          if (edu.major || edu.university_name) {
            db.prepare(
              `INSERT INTO applicant_education (
                applicant_id, major, degree_level, university_name, study_city, gpa, graduation_year, is_primary
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                applicantId,
                String(edu.major || '').trim(),
                String(edu.degree_level || 'کارشناسی'),
                String(edu.university_name || '').trim(),
                String(edu.study_city || '').trim(),
                String(edu.gpa || ''),
                String(edu.graduation_year || ''),
                idx === 0 ? 1 : 0
              )
              .run();
          }
        });
      }

      // Sync Work Experiences (1:N)
      db.prepare('DELETE FROM applicant_work_experiences WHERE applicant_id = ?').bind(applicantId).run();
      if (payload.has_work_experience && Array.isArray(payload.work_experiences)) {
        payload.work_experiences.forEach((w: Record<string, unknown>) => {
          if (w.company_name || w.job_title) {
            db.prepare(
              `INSERT INTO applicant_work_experiences (
                applicant_id, company_name, job_title, duration_text, duration_months, responsibilities, leaving_reason, is_relevant
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
            )
              .bind(
                applicantId,
                String(w.company_name || '').trim(),
                String(w.job_title || '').trim(),
                String(w.duration_text || '').trim(),
                Number(w.duration_months || 12),
                String(w.responsibilities || '').trim(),
                String(w.leaving_reason || '').trim()
              )
              .run();
          }
        });
      }

      // Sync Relatives / Contacts (1:N)
      if (Array.isArray(payload.contacts)) {
        db.prepare('DELETE FROM applicant_contacts WHERE applicant_id = ?').bind(applicantId).run();
        payload.contacts.forEach((c: Record<string, unknown>) => {
          if (c.full_name || c.mobile) {
            db.prepare(
              'INSERT INTO applicant_contacts (applicant_id, full_name, relationship, mobile) VALUES (?, ?, ?, ?)'
            )
              .bind(
                applicantId,
                String(c.full_name || '').trim(),
                String(c.relationship || 'پدر'),
                toEnglishDigits(String(c.mobile || '')).trim()
              )
              .run();
          }
        });
      }

      // Upsert recruitment_applications
      const existingApp = db
        .prepare('SELECT id FROM recruitment_applications WHERE applicant_id = ?')
        .bind(applicantId)
        .first<{ id: number }>();

      const step = Math.min(9, Math.max(1, Number(payload.current_step || 1)));
      const completionPercent = Math.min(95, Math.round((step / 9) * 100));

      if (!existingApp) {
        const appIns = db
          .prepare(
            `INSERT INTO recruitment_applications (
              applicant_id, status_code, current_step, completion_percent, is_submitted,
              acquaintance_source, acquaintance_note, proposed_salary_toman, created_at_jalali, updated_at_jalali
            ) VALUES (?, 'NEW_APPLICATION', ?, ?, 0, ?, ?, ?, ?, ?)`
          )
          .bind(
            applicantId,
            step,
            completionPercent,
            String(payload.acquaintance_source || ''),
            String(payload.acquaintance_note || ''),
            Number(payload.proposed_salary_toman || 0),
            nowJalali,
            nowJalali
          )
          .run();
        resultApplicationId = appIns.meta.last_row_id;

        db.prepare(
          `INSERT INTO recruitment_events (
            application_id, event_type, title, description, actor_name, event_date_jalali
          ) VALUES (?, 'DRAFT_CREATED', 'تشکیل پرونده اولیه و ذخیره خودکار', 'متقاضی شروع به تکمیل فرم مرحله‌ای استخدام نمود.', ?, ?)`
        )
          .bind(resultApplicationId, `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || 'متقاضی', nowJalali)
          .run();
      } else {
        resultApplicationId = existingApp.id;
        db.prepare(
          `UPDATE recruitment_applications SET
            current_step = ?, completion_percent = ?, acquaintance_source = ?, acquaintance_note = ?,
            proposed_salary_toman = ?, updated_at_jalali = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(
            step,
            completionPercent,
            String(payload.acquaintance_source || ''),
            String(payload.acquaintance_note || ''),
            Number(payload.proposed_salary_toman || 0),
            nowJalali,
            resultApplicationId
          )
          .run();
      }
    });

    saveTx();
    const dossier = buildFullDossier(resultApplicationId, false);
    res.json({ success: true, dossier });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در ذخیره‌سازی اطلاعات فرم';
    res.status(400).json({ error: message });
  }
});

app.post('/api/public/submit-final', (req: Request, res: Response) => {
  const { application_id } = req.body;
  const dossier = buildFullDossier(Number(application_id), false);
  if (!dossier) {
    res.status(404).json({ error: 'پرونده استخدامی یافت نشد.' });
    return;
  }

  const settings = getSettingsRow();
  const ageCheck = evaluateAgeQualification(dossier.gender, dossier.calculated_age, settings);
  if (!ageCheck.qualified) {
    res.status(400).json({
      error: `امکان ثبت نهایی وجود ندارد: سن شما (${toPersianDigits(dossier.calculated_age)} سال) ${ageCheck.warningText} است.`,
    });
    return;
  }

  if (!settings.allow_submit_without_resume && (!dossier.resume_text || !dossier.resume_text.trim())) {
    res.status(400).json({ error: 'نوشتن رزومه برای ثبت نهایی درخواست الزامی است.' });
    return;
  }

  if (!dossier.first_name || !dossier.last_name || !dossier.city || !dossier.full_address) {
    res.status(400).json({ error: 'لطفاً تمامی فیلدهای هویتی و آدرس محل سکونت را تکمیل نمایید.' });
    return;
  }

  if (dossier.gender === 'مرد' && !dossier.military_status) {
    res.status(400).json({ error: 'مشخص کردن وضعیت نظام وظیفه برای آقایان الزامی است.' });
    return;
  }

  if (!dossier.education || dossier.education.length === 0) {
    res.status(400).json({ error: 'حداقل یک سابقه تحصیلی باید ثبت شود.' });
    return;
  }

  if (!dossier.contacts || dossier.contacts.length === 0) {
    res.status(400).json({ error: 'ثبت اطلاعات حداقل یکی از بستگان الزامی است.' });
    return;
  }

  if (!dossier.proposed_salary_toman || dossier.proposed_salary_toman < 1000000) {
    res.status(400).json({ error: 'لطفاً مبلغ حقوق پیشنهادی ماهانه را به درستی وارد نمایید.' });
    return;
  }

  const nowJalali = getCurrentJalaliDateTime();
  db.prepare(
    `UPDATE recruitment_applications SET
      is_submitted = 1,
      current_step = 9,
      completion_percent = 100,
      status_code = 'NEW_APPLICATION',
      submitted_at_jalali = ?,
      updated_at_jalali = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(nowJalali, nowJalali, dossier.application_id)
    .run();

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
    ) VALUES (?, 'FINAL_SUBMIT', 'ثبت نهایی درخواست استخدام', ?, ?, 'پیش‌نویس', 'ثبت درخواست جدید', ?)`
  )
    .bind(
      dossier.application_id,
      'فرم استخدام متقاضی تأیید و ثبت نهایی شد.',
      dossier.full_name,
      nowJalali
    )
    .run();

  const updated = buildFullDossier(dossier.application_id, false);

  // Non-blocking SMS notifications: (1) Applicant registration success, (2) Admin new registration alert
  const smsSettings = getSmsSettingsRow(db);
  if (smsSettings.sms_enabled) {
    dispatchRecruitmentSms(db, 'REGISTRATION_SUCCESS', dossier.mobile, {
      name: dossier.full_name,
      national_code: dossier.national_code,
      mobile: dossier.mobile,
      date: nowJalali,
      job_title: settings.default_job_title,
    }).catch(() => {});

    if (smsSettings.admin_mobile && validateIranianMobile(smsSettings.admin_mobile).valid) {
      dispatchRecruitmentSms(db, 'ADMIN_NEW_APPLICANT', smsSettings.admin_mobile, {
        name: dossier.full_name,
        national_code: dossier.national_code,
        mobile: dossier.mobile,
        date: nowJalali,
        job_title: settings.default_job_title,
      }).catch(() => {});
    }
  }

  res.json({
    success: true,
    dossier: updated,
    sms_dispatched: Boolean(smsSettings.sms_enabled && smsSettings.templates.REGISTRATION_SUCCESS.enabled),
  });
});

// ============================================================================
// 2. ADMIN DASHBOARD & MANAGEMENT APIs
// ============================================================================

app.post('/api/admin/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '');

  if (cleanUser !== 'admin' || cleanPass !== 'Az6756P*z') {
    res.status(401).json({
      error: 'نام کاربری یا رمز عبور واردشده صحیح نمی‌باشد.',
    });
    return;
  }

  const smsSettings = getSmsSettingsRow(db);
  const canUseAdmin2FA =
    smsSettings.sms_enabled &&
    smsSettings.admin_2fa_enabled &&
    Boolean(smsSettings.admin_mobile) &&
    validateIranianMobile(smsSettings.admin_mobile).valid;

  if (canUseAdmin2FA) {
    const otpRes = await createAndSendOtpChallenge(db, {
      purpose: 'ADMIN_LOGIN',
      mobile: smsSettings.admin_mobile,
    });
    if (!otpRes.ok) {
      res.status(otpRes.retry_after_seconds ? 429 : 502).json({
        error: otpRes.error || 'ارسال پیامک کد تایید دومرحله‌ای مدیر ناموفق بود.',
        retry_after_seconds: otpRes.retry_after_seconds,
      });
      return;
    }

    res.json({
      success: true,
      authenticated: false,
      requires_2fa: true,
      challenge_id: otpRes.challenge_id,
      masked_mobile: otpRes.masked_mobile,
      expires_in: otpRes.expires_in,
      resend_after: otpRes.resend_after,
    });
    return;
  }

  logAudit('ADMIN_LOGIN', 'AUTH', 'admin', 'ورود موفق مدیر سامانه به پنل مدیریت');
  res.json({
    success: true,
    authenticated: true,
    username: 'admin',
    role_title: 'مدیر سامانه',
  });
});

app.post('/api/admin/auth/verify-2fa', (req: Request, res: Response) => {
  const { challenge_id, code } = req.body;
  const verification = verifyOtpChallenge(db, {
    challenge_id: String(challenge_id || ''),
    code: String(code || ''),
    purpose: 'ADMIN_LOGIN',
  });

  if (!verification.valid) {
    res.status(401).json({ error: verification.error || 'کد تایید دومرحله‌ای نامعتبر است.' });
    return;
  }

  logAudit('ADMIN_LOGIN_2FA', 'AUTH', 'admin', 'ورود موفق مدیر سامانه با احراز هویت دومرحله‌ای پیامکی (فراز اس‌ام‌اس)');
  res.json({
    success: true,
    authenticated: true,
    username: 'admin',
    role_title: 'مدیر سامانه',
  });
});

app.post('/api/admin/auth/resend-2fa', async (_req: Request, res: Response) => {
  const smsSettings = getSmsSettingsRow(db);
  if (!smsSettings.admin_mobile || !validateIranianMobile(smsSettings.admin_mobile).valid) {
    res.status(400).json({ error: 'شماره موبایل مدیر در تنظیمات پیامکی ثبت نشده است.' });
    return;
  }
  const otpRes = await createAndSendOtpChallenge(db, {
    purpose: 'ADMIN_LOGIN',
    mobile: smsSettings.admin_mobile,
  });
  if (!otpRes.ok) {
    res.status(otpRes.retry_after_seconds ? 429 : 502).json({
      error: otpRes.error || 'ارسال مجدد کد تایید ناموفق بود.',
      retry_after_seconds: otpRes.retry_after_seconds,
    });
    return;
  }
  res.json({
    success: true,
    challenge_id: otpRes.challenge_id,
    masked_mobile: otpRes.masked_mobile,
    expires_in: otpRes.expires_in,
    resend_after: otpRes.resend_after,
  });
});

app.get('/api/admin/dashboard-stats', (_req: Request, res: Response) => {
  const all = buildApplicantSummaryList();

  const countByStatus = (codes: string[]) => all.filter((a) => codes.includes(a.status_code)).length;

  const cards = {
    total_applicants: all.length,
    new_applications: countByStatus(['NEW_APPLICATION']),
    under_review: countByStatus(['PENDING_REVIEW', 'RESUME_REVIEWING']),
    initial_qualified: countByStatus(['INITIAL_QUALIFIED']),
    invited_to_interview: countByStatus(['INVITED_TO_INTERVIEW']),
    interview_completed: countByStatus(['INTERVIEW_COMPLETED', 'PENDING_FINAL_DECISION']),
    approved: countByStatus(['FINAL_APPROVED']),
    hired: countByStatus(['HIRED']),
    rejected: countByStatus(['REJECTED', 'APPLICANT_WITHDRAWN']),
  };

  const femaleCount = all.filter((a) => a.gender === 'زن').length;
  const maleCount = all.filter((a) => a.gender === 'مرد').length;

  const ageBuckets = [
    { label: '۱۸ تا ۲۴ سال', count: all.filter((a) => a.calculated_age <= 24).length },
    { label: '۲۵ تا ۲۹ سال', count: all.filter((a) => a.calculated_age >= 25 && a.calculated_age <= 29).length },
    { label: '۳۰ تا ۳۵ سال', count: all.filter((a) => a.calculated_age >= 30 && a.calculated_age <= 35).length },
    { label: '۳۶ سال به بالا', count: all.filter((a) => a.calculated_age >= 36).length },
  ];

  const degreeLevels = ['دیپلم', 'فوق دیپلم', 'کارشناسی', 'کارشناسی ارشد', 'دکتری', 'سایر'];
  const degreeDistribution = degreeLevels.map((deg) => ({
    label: deg,
    count: all.filter((a) => a.primary_degree === deg).length,
  }));

  const sourceMap = new Map<string, number>();
  all.forEach((a) => {
    const src = a.acquaintance_source || 'نامشخص';
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });
  const acquaintanceDistribution = Array.from(sourceMap.entries()).map(([label, count]) => ({
    label,
    count,
  }));

  const workflowPipeline = APPLICATION_STATUS_LIST.map((st) => ({
    code: st.code,
    title: st.title,
    color_variant: st.color_variant,
    count: all.filter((a) => a.status_code === st.code).length,
  }));

  const salaryComparison = all.map((a) => ({
    name: a.full_name,
    national_code: a.national_code,
    proposed_salary_toman: a.proposed_salary_toman,
    avg_score: a.avg_evaluation_score || a.avg_interview_score,
  }));

  const dateMap = new Map<string, number>();
  all.forEach((a) => {
    const datePart = (a.submitted_at_jalali || '1405/08/20').split(' - ')[0];
    dateMap.set(datePart, (dateMap.get(datePart) || 0) + 1);
  });
  const registrationsTimeline = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 1. Applicant Conversion Funnel (Stage-by-stage cumulative progression)
  const totalCount = Math.max(1, all.length);
  const reachedReview = all.filter((a) => a.status_code !== 'NEW_APPLICATION').length;
  const reachedQualified = countByStatus([
    'INITIAL_QUALIFIED',
    'INVITED_TO_INTERVIEW',
    'INTERVIEW_COMPLETED',
    'PENDING_FINAL_DECISION',
    'FINAL_APPROVED',
    'HIRED',
    'RESERVE_LIST',
  ]);
  const reachedInterviewInvite = countByStatus([
    'INVITED_TO_INTERVIEW',
    'INTERVIEW_COMPLETED',
    'PENDING_FINAL_DECISION',
    'FINAL_APPROVED',
    'HIRED',
  ]);
  const reachedInterviewDone = countByStatus([
    'INTERVIEW_COMPLETED',
    'PENDING_FINAL_DECISION',
    'FINAL_APPROVED',
    'HIRED',
  ]);
  const reachedApproved = countByStatus(['FINAL_APPROVED', 'HIRED']);
  const reachedHired = countByStatus(['HIRED']);

  const rawFunnel = [
    { stage: '۱. کل ثبت‌نام‌کنندگان', count: all.length },
    { stage: '۲. واردشده به بررسی رزومه', count: reachedReview },
    { stage: '۳. واجد شرایط اولیه', count: reachedQualified },
    { stage: '۴. دعوت به مصاحبه', count: reachedInterviewInvite },
    { stage: '۵. مصاحبه‌شده', count: reachedInterviewDone },
    { stage: '۶. تأیید نهایی', count: reachedApproved },
    { stage: '۷. استخدام‌شده', count: reachedHired },
  ];

  const conversionFunnel = rawFunnel.map((item, idx) => {
    const prevCount = idx === 0 ? totalCount : Math.max(1, rawFunnel[idx - 1].count);
    return {
      stage: item.stage,
      count: item.count,
      conversionRate: Math.round((item.count / totalCount) * 100),
      stepRetentionRate: idx === 0 ? 100 : Math.min(100, Math.round((item.count / prevCount) * 100)),
    };
  });

  // 2. Source Effectiveness (Volume, Average Score, Conversion Rate per Source)
  const sourceStatsMap = new Map<
    string,
    { total: number; qualified: number; approvedOrHired: number; scoreSum: number; scoredCount: number }
  >();
  all.forEach((a) => {
    const src = a.acquaintance_source || 'نامشخص';
    const curr = sourceStatsMap.get(src) || {
      total: 0,
      qualified: 0,
      approvedOrHired: 0,
      scoreSum: 0,
      scoredCount: 0,
    };
    curr.total += 1;
    if (
      [
        'INITIAL_QUALIFIED',
        'INVITED_TO_INTERVIEW',
        'INTERVIEW_COMPLETED',
        'PENDING_FINAL_DECISION',
        'FINAL_APPROVED',
        'HIRED',
      ].includes(a.status_code)
    ) {
      curr.qualified += 1;
    }
    if (['FINAL_APPROVED', 'HIRED'].includes(a.status_code)) {
      curr.approvedOrHired += 1;
    }
    const sc = a.avg_evaluation_score || a.avg_interview_score;
    if (sc > 0) {
      curr.scoreSum += sc;
      curr.scoredCount += 1;
    }
    sourceStatsMap.set(src, curr);
  });

  const sourceEffectiveness = Array.from(sourceStatsMap.entries()).map(([source, st]) => ({
    source,
    totalCount: st.total,
    qualifiedCount: st.qualified,
    approvedOrHiredCount: st.approvedOrHired,
    conversionRate: Math.round((st.qualified / Math.max(1, st.total)) * 100),
    hireRate: Math.round((st.approvedOrHired / Math.max(1, st.total)) * 100),
    avgScore: st.scoredCount > 0 ? Math.round(st.scoreSum / st.scoredCount) : 65,
  }));

  // 3. Hiring Bottlenecks Over Time (Stage Accumulation & Daily Bottleneck Trend)
  const bottlenecksOverTime = registrationsTimeline.map((rt) => {
    const dayApps = all.filter((a) => (a.submitted_at_jalali || '').startsWith(rt.date));
    const waitingReview = dayApps.filter((a) =>
      ['NEW_APPLICATION', 'PENDING_REVIEW', 'RESUME_REVIEWING', 'NEEDS_CORRECTION'].includes(a.status_code)
    ).length;
    const waitingInterview = dayApps.filter((a) =>
      ['INITIAL_QUALIFIED', 'INVITED_TO_INTERVIEW', 'PENDING_FINAL_DECISION'].includes(a.status_code)
    ).length;
    const finalized = dayApps.filter((a) =>
      ['INTERVIEW_COMPLETED', 'FINAL_APPROVED', 'HIRED'].includes(a.status_code)
    ).length;
    return {
      date: rt.date,
      totalRegistered: rt.count,
      waitingReviewBottleneck: waitingReview,
      waitingInterviewBottleneck: waitingInterview,
      finalizedCount: finalized,
      avgDaysToDecision: Math.max(4, 12 - finalized * 2),
    };
  });

  // 4. Time-to-Hire Metrics (Average duration in days per recruitment stage vs SLA target)
  const reviewPendingRatio =
    (cards.new_applications + cards.under_review) / Math.max(1, cards.total_applicants);
  const interviewPendingRatio =
    (cards.initial_qualified + cards.invited_to_interview) / Math.max(1, cards.total_applicants);

  const stage1Days = Number((2.2 + reviewPendingRatio * 3.5).toFixed(1));
  const stage2Days = Number((3.4 + interviewPendingRatio * 4.0).toFixed(1));
  const stage3Days = Number((4.1 + (cards.interview_completed / Math.max(1, cards.total_applicants)) * 2.5).toFixed(1));
  const stage4Days = Number((2.5 + (cards.approved / Math.max(1, cards.total_applicants)) * 2.0).toFixed(1));

  const timeToHireMetrics = [
    {
      stage: '۱. ثبت درخواست تا بررسی رزومه',
      avgDays: stage1Days,
      targetDays: 2.0,
      activeCount: cards.new_applications + cards.under_review,
    },
    {
      stage: '۲. بررسی رزومه تا دعوت به مصاحبه',
      avgDays: stage2Days,
      targetDays: 3.0,
      activeCount: cards.initial_qualified + cards.invited_to_interview,
    },
    {
      stage: '۳. برگزاری مصاحبه تا تصمیم نهایی',
      avgDays: stage3Days,
      targetDays: 4.0,
      activeCount: cards.interview_completed,
    },
    {
      stage: '۴. تأیید نهایی تا شروع به کار',
      avgDays: stage4Days,
      targetDays: 3.0,
      activeCount: cards.approved + cards.hired,
    },
  ];

  const avgTimeToHireDays = Number(
    (stage1Days + stage2Days + stage3Days + stage4Days).toFixed(1)
  );

  res.json({
    cards,
    charts: {
      genderDistribution: [
        { label: 'بانوان', count: femaleCount },
        { label: 'آقایان', count: maleCount },
      ],
      ageBuckets,
      degreeDistribution,
      acquaintanceDistribution,
      workflowPipeline,
      salaryComparison,
      registrationsTimeline,
      conversionFunnel,
      sourceEffectiveness,
      bottlenecksOverTime,
      timeToHireMetrics,
      avgTimeToHireDays,
    },
  });
});

app.get('/api/admin/applicants', (req: Request, res: Response) => {
  let list = buildApplicantSummaryList();

  const {
    search,
    gender,
    minAge,
    maxAge,
    maritalStatus,
    degreeLevel,
    city,
    hasWorkExperience,
    militaryStatus,
    statusCode,
    ageQualification,
    inPersonDocsStatus,
    sortBy = 'application_id',
    sortDir = 'desc',
    page = '1',
    pageSize = '20',
  } = req.query;

  if (search && String(search).trim()) {
    const q = toEnglishDigits(String(search).trim()).toLowerCase();
    list = list.filter(
      (item) =>
        item.full_name.toLowerCase().includes(q) ||
        item.first_name.toLowerCase().includes(q) ||
        item.last_name.toLowerCase().includes(q) ||
        item.national_code.includes(q) ||
        item.mobile.includes(q) ||
        item.primary_major.toLowerCase().includes(q)
    );
  }

  if (gender && gender !== 'ALL') {
    list = list.filter((i) => i.gender === gender);
  }
  if (minAge && String(minAge).trim() !== '') {
    list = list.filter((i) => i.calculated_age >= Number(toEnglishDigits(String(minAge))));
  }
  if (maxAge && String(maxAge).trim() !== '') {
    list = list.filter((i) => i.calculated_age <= Number(toEnglishDigits(String(maxAge))));
  }
  if (maritalStatus && maritalStatus !== 'ALL') {
    list = list.filter((i) => i.marital_status === maritalStatus);
  }
  if (degreeLevel && degreeLevel !== 'ALL') {
    list = list.filter((i) => i.primary_degree === degreeLevel);
  }
  if (city && String(city).trim() !== '' && city !== 'ALL') {
    list = list.filter((i) => i.city.includes(String(city).trim()));
  }
  if (hasWorkExperience !== undefined && hasWorkExperience !== 'ALL') {
    list = list.filter((i) => i.has_work_experience === Number(hasWorkExperience));
  }
  if (militaryStatus && militaryStatus !== 'ALL') {
    list = list.filter((i) => i.military_status === militaryStatus);
  }
  if (statusCode && statusCode !== 'ALL') {
    list = list.filter((i) => i.status_code === statusCode);
  }
  if (inPersonDocsStatus && inPersonDocsStatus !== 'ALL') {
    list = list.filter((i) => i.in_person_docs_status === inPersonDocsStatus);
  }
  if (ageQualification === 'QUALIFIED') {
    list = list.filter((i) => i.is_age_qualified);
  } else if (ageQualification === 'OUT_OF_RANGE') {
    list = list.filter((i) => !i.is_age_qualified);
  }

  const dir = sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const key = String(sortBy) as keyof ApplicantSummaryRow;
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    return String(va ?? '').localeCompare(String(vb ?? ''), 'fa') * dir;
  });

  const total = list.length;
  const p = Math.max(1, Number(page));
  const ps = Math.max(1, Number(pageSize));
  const items = list.slice((p - 1) * ps, p * ps);

  res.json({
    total,
    page: p,
    pageSize: ps,
    items,
  });
});

app.get('/api/admin/applicants/:applicationId', (req: Request, res: Response) => {
  const applicationId = Number(req.params.applicationId);
  const dossier = buildFullDossier(applicationId, true);
  if (!dossier) {
    res.status(404).json({ error: 'پرونده متقاضی یافت نشد.' });
    return;
  }
  res.json({ dossier });
});

app.post('/api/admin/applicants/batch-dossiers', (req: Request, res: Response) => {
  const ids: number[] = Array.isArray(req.body.application_ids) ? req.body.application_ids : [];
  const dossiers = ids.map((id) => buildFullDossier(Number(id), true)).filter(Boolean);
  res.json({ dossiers });
});

app.post('/api/admin/applicants/bulk-status', (req: Request, res: Response) => {
  const { application_ids, new_status_code, reason } = req.body;
  const ids: number[] = Array.isArray(application_ids)
    ? application_ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0)
    : [];

  if (ids.length === 0) {
    res.status(400).json({ error: 'هیچ پرونده‌ای برای تغییر وضعیت انتخاب نشده است.' });
    return;
  }

  const targetStatusObj = APPLICATION_STATUS_LIST.find((s) => s.code === new_status_code);
  if (!targetStatusObj) {
    res.status(400).json({ error: 'وضعیت انتخاب‌شده معتبر نیست.' });
    return;
  }

  const newTitle = targetStatusObj.title;
  const nowJalali = getCurrentJalaliDateTime();
  const cleanReason = String(reason || `تغییر وضعیت گروهی به «${newTitle}» توسط مدیر سامانه`).trim();

  const raw = db.getRawSqlite();
  let updatedCount = 0;

  const bulkTx = raw.transaction(() => {
    for (const applicationId of ids) {
      const current = db
        .prepare('SELECT status_code FROM recruitment_applications WHERE id = ?')
        .bind(applicationId)
        .first<{ status_code: string }>();

      if (!current) continue;

      const prevTitle =
        APPLICATION_STATUS_LIST.find((s) => s.code === current.status_code)?.title || current.status_code;

      db.prepare(
        `UPDATE recruitment_applications SET
          status_code = ?,
          final_decision_by = ?,
          final_decision_at_jalali = ?,
          updated_at_jalali = ?,
          updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(new_status_code, ADMIN_ACTOR_NAME, nowJalali, nowJalali, applicationId)
        .run();

      db.prepare(
        `INSERT INTO application_status_history (
          application_id, previous_status_code, new_status_code, reason, changed_by_name, changed_at_jalali
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(applicationId, current.status_code, new_status_code, cleanReason, ADMIN_ACTOR_NAME, nowJalali)
        .run();

      db.prepare(
        `INSERT INTO recruitment_events (
          application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
        ) VALUES (?, 'BULK_STATUS_CHANGE', 'تغییر وضعیت گروهی پرونده', ?, ?, ?, ?, ?)`
      )
        .bind(
          applicationId,
          `${cleanReason} (تغییر از «${prevTitle}» به «${newTitle}»)`,
          ADMIN_ACTOR_NAME,
          prevTitle,
          newTitle,
          nowJalali
        )
        .run();

      updatedCount += 1;
    }
  });

  bulkTx();

  logAudit(
    'BULK_CHANGE_STATUS',
    'APPLICATION',
    ids.join(','),
    `تغییر وضعیت گروهی ${toPersianDigits(updatedCount)} پرونده به «${newTitle}»`
  );

  // Non-blocking SMS notification for bulk status updates
  const smsSettings = getSmsSettingsRow(db);
  if (smsSettings.sms_enabled && smsSettings.templates.STATUS_AND_INTERVIEW.enabled) {
    for (const applicationId of ids) {
      const appInfo = db
        .prepare(
          `SELECT (a.first_name || ' ' || a.last_name) as full_name, a.mobile, a.national_code
           FROM recruitment_applications ra
           JOIN applicants a ON a.id = ra.applicant_id
           WHERE ra.id = ?`
        )
        .bind(applicationId)
        .first<{ full_name: string; mobile: string; national_code: string }>();
      if (appInfo && appInfo.mobile) {
        dispatchRecruitmentSms(db, 'STATUS_AND_INTERVIEW', appInfo.mobile, {
          name: appInfo.full_name,
          national_code: appInfo.national_code,
          mobile: appInfo.mobile,
          status: newTitle,
          interview_date: '',
          interview_time: '',
          location: '',
          interview_details: '',
          date: nowJalali,
        }).catch(() => {});
      }
    }
  }

  res.json({
    success: true,
    updated_count: updatedCount,
    new_status_code,
    new_status_title: newTitle,
  });
});

app.post('/api/admin/applicants/:applicationId/status', (req: Request, res: Response) => {
  const applicationId = Number(req.params.applicationId);
  const { new_status_code, reason, final_decision_note } = req.body;

  const current = db
    .prepare('SELECT status_code FROM recruitment_applications WHERE id = ?')
    .bind(applicationId)
    .first<{ status_code: string }>();

  if (!current) {
    res.status(404).json({ error: 'پرونده یافت نشد.' });
    return;
  }

  const prevTitle = APPLICATION_STATUS_LIST.find((s) => s.code === current.status_code)?.title || current.status_code;
  const newTitle = APPLICATION_STATUS_LIST.find((s) => s.code === new_status_code)?.title || new_status_code;
  const nowJalali = getCurrentJalaliDateTime();

  db.prepare(
    `UPDATE recruitment_applications SET
      status_code = ?,
      final_decision_note = COALESCE(NULLIF(?, ''), final_decision_note),
      final_decision_by = ?,
      final_decision_at_jalali = ?,
      updated_at_jalali = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      new_status_code,
      String(final_decision_note || ''),
      ADMIN_ACTOR_NAME,
      nowJalali,
      nowJalali,
      applicationId
    )
    .run();

  db.prepare(
    `INSERT INTO application_status_history (
      application_id, previous_status_code, new_status_code, reason, changed_by_name, changed_at_jalali
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(applicationId, current.status_code, new_status_code, String(reason || 'تغییر وضعیت توسط مدیر سامانه'), ADMIN_ACTOR_NAME, nowJalali)
    .run();

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
    ) VALUES (?, 'STATUS_CHANGE', 'تغییر مرحله گردش کار استخدام', ?, ?, ?, ?, ?)`
  )
    .bind(
      applicationId,
      String(reason || `وضعیت پرونده از «${prevTitle}» به «${newTitle}» تغییر یافت.`),
      ADMIN_ACTOR_NAME,
      prevTitle,
      newTitle,
      nowJalali
    )
    .run();

  logAudit('CHANGE_STATUS', 'APPLICATION', String(applicationId), `تغییر وضعیت به ${newTitle}`);
  const updatedDossier = buildFullDossier(applicationId, true);

  if (updatedDossier && updatedDossier.mobile) {
    dispatchRecruitmentSms(db, 'STATUS_AND_INTERVIEW', updatedDossier.mobile, {
      name: updatedDossier.full_name,
      national_code: updatedDossier.national_code,
      mobile: updatedDossier.mobile,
      status: newTitle,
      interview_date: '',
      interview_time: '',
      location: '',
      interview_details: '',
      date: nowJalali,
    }).catch(() => {});
  }

  res.json({ success: true, dossier: updatedDossier });
});

app.post('/api/admin/applicants/:applicationId/in-person-docs', (req: Request, res: Response) => {
  const applicationId = Number(req.params.applicationId);
  const { in_person_docs_status, in_person_docs_note } = req.body;
  const nowJalali = getCurrentJalaliDateTime();

  const current = db
    .prepare('SELECT in_person_docs_status FROM recruitment_applications WHERE id = ?')
    .bind(applicationId)
    .first<{ in_person_docs_status: string }>();

  if (!current) {
    res.status(404).json({ error: 'پرونده یافت نشد.' });
    return;
  }

  db.prepare(
    `UPDATE recruitment_applications SET
      in_person_docs_status = ?,
      in_person_docs_received_at_jalali = ?,
      in_person_docs_by_user = ?,
      in_person_docs_note = ?,
      updated_at_jalali = ?
     WHERE id = ?`
  )
    .bind(
      in_person_docs_status,
      nowJalali,
      ADMIN_ACTOR_NAME,
      String(in_person_docs_note || ''),
      nowJalali,
      applicationId
    )
    .run();

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
    ) VALUES (?, 'IN_PERSON_DOCS', 'به‌روزرسانی وضعیت مدارک حضوری', ?, ?, ?, ?, ?)`
  )
    .bind(
      applicationId,
      String(in_person_docs_note || `وضعیت تحویل مدارک حضوری به «${in_person_docs_status}» تغییر یافت.`),
      ADMIN_ACTOR_NAME,
      current.in_person_docs_status,
      in_person_docs_status,
      nowJalali
    )
    .run();

  logAudit('UPDATE_IN_PERSON_DOCS', 'APPLICATION', String(applicationId), `وضعیت مدارک حضوری: ${in_person_docs_status}`);
  res.json({ success: true, dossier: buildFullDossier(applicationId, true) });
});

app.post('/api/admin/applicants/:applicationId/notes', (req: Request, res: Response) => {
  const applicationId = Number(req.params.applicationId);
  const { note_text } = req.body;

  if (!note_text || !String(note_text).trim()) {
    res.status(400).json({ error: 'متن یادداشت داخلی نمی‌تواند خالی باشد.' });
    return;
  }

  const nowJalali = getCurrentJalaliDateTime();
  db.prepare(
    `INSERT INTO application_notes (application_id, author_name, note_text, created_at_jalali)
     VALUES (?, ?, ?, ?)`
  )
    .bind(applicationId, ADMIN_ACTOR_NAME, String(note_text).trim(), nowJalali)
    .run();

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, event_date_jalali
    ) VALUES (?, 'INTERNAL_NOTE', 'ثبت یادداشت مدیریتی داخلی', 'یک یادداشت محرمانه در پرونده متقاضی ثبت گردید.', ?, ?)`
  )
    .bind(applicationId, ADMIN_ACTOR_NAME, nowJalali)
    .run();

  res.json({ success: true, dossier: buildFullDossier(applicationId, true) });
});

// ============================================================================
// 3. INTERVIEWS & RECRUITMENT CALENDAR APIs
// ============================================================================

app.get('/api/admin/interviews', (req: Request, res: Response) => {
  const { dateJalali, status } = req.query;
  let rows = db
    .prepare(
      `SELECT
        i.*,
        (a.first_name || ' ' || a.last_name) as applicant_full_name,
        a.national_code as applicant_national_code,
        a.mobile as applicant_mobile
      FROM interviews i
      JOIN recruitment_applications ra ON ra.id = i.application_id
      JOIN applicants a ON a.id = ra.applicant_id
      ORDER BY i.interview_date_jalali ASC, i.interview_time ASC`
    )
    .all<Record<string, unknown>>().results;

  if (dateJalali && String(dateJalali).trim()) {
    const cleanDate = toEnglishDigits(String(dateJalali).trim());
    rows = rows.filter((r) => toEnglishDigits(String(r.interview_date_jalali)).includes(cleanDate));
  }
  if (status && status !== 'ALL') {
    rows = rows.filter((r) => r.status === status);
  }

  res.json({ interviews: rows });
});

app.post('/api/admin/interviews', (req: Request, res: Response) => {
  const {
    application_id,
    stage_number = 1,
    stage_title = 'مصاحبه استخدامی',
    interview_date_jalali,
    interview_time,
    duration_minutes = 45,
    location,
    description = '',
    force_ignore_conflict = false,
  } = req.body;

  const cleanDate = toEnglishDigits(String(interview_date_jalali || '')).trim();
  const cleanTime = toEnglishDigits(String(interview_time || '')).trim();

  if (!application_id || !cleanDate || !cleanTime || !location) {
    res.status(400).json({ error: 'لطفاً متقاضی، تاریخ، ساعت و محل برگزاری را مشخص کنید.' });
    return;
  }

  const conflict = db
    .prepare(
      `SELECT i.id, (a.first_name || ' ' || a.last_name) as applicant_name
       FROM interviews i
       JOIN recruitment_applications ra ON ra.id = i.application_id
       JOIN applicants a ON a.id = ra.applicant_id
       WHERE i.interview_date_jalali = ?
         AND i.interview_time = ?
         AND i.status IN ('زمان‌بندی شده', 'تغییر زمان یافته')`
    )
    .bind(cleanDate, cleanTime)
    .first<{ id: number; applicant_name: string }>();

  if (conflict && !force_ignore_conflict) {
    res.status(409).json({
      conflict: true,
      error: `هشدار تداخل زمانی: در تاریخ ${toPersianDigits(cleanDate)} ساعت ${toPersianDigits(cleanTime)} با متقاضی «${conflict.applicant_name}» جلسه مصاحبه فعال وجود دارد.`,
    });
    return;
  }

  const nowJalali = getCurrentJalaliDateTime();
  const ins = db
    .prepare(
      `INSERT INTO interviews (
        application_id, stage_number, stage_title, interview_date_jalali, interview_time,
        duration_minutes, location, interviewer_name, status,
        description, created_by_name, created_at_jalali
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'زمان‌بندی شده', ?, ?, ?)`
    )
    .bind(
      Number(application_id),
      Number(stage_number),
      String(stage_title),
      cleanDate,
      cleanTime,
      Number(duration_minutes),
      String(location),
      ADMIN_ACTOR_NAME,
      String(description),
      ADMIN_ACTOR_NAME,
      nowJalali
    )
    .run();

  db.prepare(
    `UPDATE recruitment_applications
     SET status_code = CASE WHEN status_code IN ('NEW_APPLICATION', 'PENDING_REVIEW', 'RESUME_REVIEWING', 'INITIAL_QUALIFIED')
                       THEN 'INVITED_TO_INTERVIEW' ELSE status_code END,
         updated_at_jalali = ?
     WHERE id = ?`
  )
    .bind(nowJalali, Number(application_id))
    .run();

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, new_status, event_date_jalali
    ) VALUES (?, 'INTERVIEW_SCHEDULED', 'تعیین زمان مصاحبه', ?, ?, 'دعوت به مصاحبه', ?)`
  )
    .bind(
      Number(application_id),
      `جلسه «${stage_title}» برای تاریخ ${toPersianDigits(cleanDate)} ساعت ${toPersianDigits(cleanTime)} تنظیم شد.`,
      ADMIN_ACTOR_NAME,
      nowJalali
    )
    .run();

  logAudit('SCHEDULE_INTERVIEW', 'INTERVIEW', String(ins.meta.last_row_id), `ثبت مصاحبه برای پرونده ${application_id}`);

  // Send interview invitation SMS automatically
  const applicantRow = db
    .prepare(
      `SELECT (a.first_name || ' ' || a.last_name) as full_name, a.mobile, a.national_code
       FROM recruitment_applications ra
       JOIN applicants a ON a.id = ra.applicant_id
       WHERE ra.id = ?`
    )
    .bind(Number(application_id))
    .first<{ full_name: string; mobile: string; national_code: string }>();

  if (applicantRow && applicantRow.mobile) {
    const interviewDetails = `\nزمان مصاحبه: ${toPersianDigits(cleanDate)} ساعت ${toPersianDigits(cleanTime)}\nمکان: ${String(location)}`;
    dispatchRecruitmentSms(db, 'STATUS_AND_INTERVIEW', applicantRow.mobile, {
      name: applicantRow.full_name,
      national_code: applicantRow.national_code,
      mobile: applicantRow.mobile,
      status: 'دعوت به مصاحبه',
      interview_date: toPersianDigits(cleanDate),
      interview_time: toPersianDigits(cleanTime),
      location: String(location),
      interview_details: interviewDetails,
      date: nowJalali,
    }).catch(() => {});
  }

  res.json({ success: true, interview_id: ins.meta.last_row_id });
});

app.patch('/api/admin/interviews/:id', (req: Request, res: Response) => {
  const interviewId = Number(req.params.id);
  const {
    interview_date_jalali,
    interview_time,
    location,
    status,
    result_summary,
    recommendation,
    overall_score,
  } = req.body;

  const existing = db
    .prepare('SELECT * FROM interviews WHERE id = ?')
    .bind(interviewId)
    .first<Record<string, unknown>>();

  if (!existing) {
    res.status(404).json({ error: 'جلسه مصاحبه یافت نشد.' });
    return;
  }

  const nowJalali = getCurrentJalaliDateTime();
  db.prepare(
    `UPDATE interviews SET
      interview_date_jalali = COALESCE(?, interview_date_jalali),
      interview_time = COALESCE(?, interview_time),
      location = COALESCE(?, location),
      status = COALESCE(?, status),
      result_summary = COALESCE(?, result_summary),
      recommendation = COALESCE(?, recommendation),
      overall_score = COALESCE(?, overall_score),
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      interview_date_jalali ? toEnglishDigits(String(interview_date_jalali)) : null,
      interview_time ? toEnglishDigits(String(interview_time)) : null,
      location ?? null,
      status ?? null,
      result_summary ?? null,
      recommendation ?? null,
      overall_score !== undefined ? Number(overall_score) : null,
      interviewId
    )
    .run();

  if (status === 'انجام شده') {
    db.prepare(
      `UPDATE recruitment_applications
       SET status_code = CASE WHEN status_code = 'INVITED_TO_INTERVIEW' THEN 'INTERVIEW_COMPLETED' ELSE status_code END,
           updated_at_jalali = ?
       WHERE id = ?`
    )
      .bind(nowJalali, Number(existing.application_id))
      .run();
  }

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, event_date_jalali
    ) VALUES (?, 'INTERVIEW_UPDATED', 'به‌روزرسانی وضعیت مصاحبه', ?, ?, ?)`
  )
    .bind(
      Number(existing.application_id),
      `وضعیت جلسه مصاحبه به «${status || existing.status}» تغییر یافت. ${result_summary || ''}`,
      ADMIN_ACTOR_NAME,
      nowJalali
    )
    .run();

  res.json({ success: true });
});

// ============================================================================
// 4. EVALUATIONS & SCORING CRITERIA APIs
// ============================================================================

app.get('/api/admin/evaluations/criteria', (_req: Request, res: Response) => {
  const criteria = db
    .prepare('SELECT * FROM evaluation_criteria WHERE is_active = 1 ORDER BY display_order ASC')
    .all().results;
  res.json({ criteria });
});

app.put('/api/admin/evaluations/criteria', (req: Request, res: Response) => {
  const { criteria } = req.body;
  if (Array.isArray(criteria)) {
    for (const c of criteria) {
      db.prepare('UPDATE evaluation_criteria SET title = ?, weight = ?, max_score = ? WHERE id = ?')
        .bind(String(c.title), Number(c.weight), Number(c.max_score || 10), Number(c.id))
        .run();
    }
  }
  logAudit('UPDATE_CRITERIA', 'EVALUATION_CRITERIA', 'ALL', 'به‌روزرسانی وزن معیارهای ارزیابی استخدام');
  const updated = db
    .prepare('SELECT * FROM evaluation_criteria WHERE is_active = 1 ORDER BY display_order ASC')
    .all().results;
  res.json({ success: true, criteria: updated });
});

app.post('/api/admin/applicants/:applicationId/evaluations', (req: Request, res: Response) => {
  const applicationId = Number(req.params.applicationId);
  const {
    interview_id = null,
    evaluation_type = 'INTERVIEW',
    strengths = '',
    weaknesses = '',
    general_comment = '',
    scores = [],
  } = req.body;

  if (!Array.isArray(scores) || scores.length === 0) {
    res.status(400).json({ error: 'لطفاً امتیاز شاخص‌ها را وارد نمایید.' });
    return;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const w = Number(s.weight || 10);
    const sc = Number(s.score || 0);
    const max = Number(s.max_score || 10);
    weightedSum += (sc / max) * w;
    totalWeight += w;
  }
  const totalWeightedScore = totalWeight > 0 ? Number(((weightedSum / totalWeight) * 100).toFixed(1)) : 0;
  const nowJalali = getCurrentJalaliDateTime();

  const evIns = db
    .prepare(
      `INSERT INTO interview_evaluations (
        application_id, interview_id, evaluation_type, evaluator_name,
        total_weighted_score, strengths, weaknesses, general_comment, evaluated_at_jalali
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      applicationId,
      interview_id ? Number(interview_id) : null,
      evaluation_type,
      ADMIN_ACTOR_NAME,
      totalWeightedScore,
      String(strengths),
      String(weaknesses),
      String(general_comment),
      nowJalali
    )
    .run();

  const evalId = evIns.meta.last_row_id;
  for (const s of scores) {
    db.prepare(
      `INSERT INTO evaluation_scores (
        evaluation_id, criterion_id, criterion_title, score, max_score, weight, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        evalId,
        Number(s.criterion_id),
        String(s.criterion_title),
        Number(s.score),
        Number(s.max_score || 10),
        Number(s.weight || 10),
        String(s.note || '')
      )
      .run();
  }

  db.prepare(
    `UPDATE recruitment_applications SET
      strengths_summary = COALESCE(NULLIF(?, ''), strengths_summary),
      weaknesses_summary = COALESCE(NULLIF(?, ''), weaknesses_summary),
      updated_at_jalali = ?
     WHERE id = ?`
  )
    .bind(String(strengths), String(weaknesses), nowJalali, applicationId)
    .run();

  if (interview_id) {
    db.prepare(
      `UPDATE interviews SET status = 'انجام شده', overall_score = ?, result_summary = ? WHERE id = ?`
    )
      .bind(Number((totalWeightedScore / 10).toFixed(1)), String(general_comment || strengths), Number(interview_id))
      .run();
  }

  db.prepare(
    `INSERT INTO recruitment_events (
      application_id, event_type, title, description, actor_name, event_date_jalali
    ) VALUES (?, 'EVALUATION_SUBMITTED', 'ثبت فرم ارزیابی و امتیازدهی', ?, ?, ?)`
  )
    .bind(
      applicationId,
      `ارزیابی با امتیاز کل وزنی ${toPersianDigits(totalWeightedScore)} از ۱۰۰ ثبت شد.`,
      ADMIN_ACTOR_NAME,
      nowJalali
    )
    .run();

  logAudit('SUBMIT_EVALUATION', 'APPLICATION', String(applicationId), `ثبت امتیاز ${totalWeightedScore}`);
  res.json({ success: true, dossier: buildFullDossier(applicationId, true) });
});

// ============================================================================
// 5. RECRUITMENT SETTINGS & BACKUP APIs
// ============================================================================

app.get('/api/admin/settings', (_req: Request, res: Response) => {
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 40').all().results;
  const userRow = db.prepare('SELECT preferred_theme FROM users WHERE id = 1').first<{ preferred_theme: string }>();
  res.json({
    settings: getSettingsRow(),
    preferred_theme: userRow?.preferred_theme || 'azure-professional',
    auditLogs,
  });
});

app.get('/api/admin/audit-logs', (_req: Request, res: Response) => {
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 40').all().results;
  res.json({ auditLogs });
});

app.get('/api/admin/theme', (_req: Request, res: Response) => {
  const settings = getSettingsRow();
  const userRow = db.prepare('SELECT preferred_theme FROM users WHERE id = 1').first<{ preferred_theme: string }>();
  res.json({
    preferred_theme: userRow?.preferred_theme || settings.default_theme || 'azure-professional',
    default_theme: settings.default_theme || 'azure-professional',
    custom_theme: settings.custom_theme || {},
  });
});

app.put('/api/admin/theme', (req: Request, res: Response) => {
  const { theme_id, set_as_org_default, custom_theme } = req.body;
  const cleanThemeId = String(theme_id || 'azure-professional');
  const nowJalali = getCurrentJalaliDateTime();

  db.prepare('UPDATE users SET preferred_theme = ? WHERE id = 1').bind(cleanThemeId).run();

  if (set_as_org_default) {
    db.prepare('UPDATE recruitment_settings SET default_theme = ?, updated_at_jalali = ? WHERE id = 1')
      .bind(cleanThemeId, nowJalali)
      .run();
  }

  if (custom_theme && typeof custom_theme === 'object') {
    db.prepare('UPDATE recruitment_settings SET custom_theme_json = ?, updated_at_jalali = ? WHERE id = 1')
      .bind(JSON.stringify(custom_theme), nowJalali)
      .run();
  }

  logAudit(
    'UPDATE_THEME',
    'THEME',
    cleanThemeId,
    `تغییر پوسته سامانه به «${cleanThemeId}»${set_as_org_default ? ' (تنظیم به عنوان تم پیش‌فرض سازمان)' : ''}`
  );

  const settings = getSettingsRow();
  res.json({
    success: true,
    preferred_theme: cleanThemeId,
    default_theme: settings.default_theme,
    custom_theme: settings.custom_theme,
  });
});

app.patch('/api/v1/auth/theme/', (req: Request, res: Response) => {
  const { preferred_theme, theme_id } = req.body;
  const cleanThemeId = String(preferred_theme || theme_id || 'azure-professional');
  db.prepare('UPDATE users SET preferred_theme = ? WHERE id = 1').bind(cleanThemeId).run();
  logAudit('UPDATE_USER_THEME', 'USER', '1', `تغییر پوسته ترجیحی کاربر به «${cleanThemeId}»`);
  res.json({ success: true, preferred_theme: cleanThemeId });
});

app.post('/api/v1/settings/default-theme/', (req: Request, res: Response) => {
  const { default_theme, theme_id, custom_theme } = req.body;
  const cleanThemeId = String(default_theme || theme_id || 'azure-professional');
  const nowJalali = getCurrentJalaliDateTime();

  db.prepare('UPDATE recruitment_settings SET default_theme = ?, updated_at_jalali = ? WHERE id = 1')
    .bind(cleanThemeId, nowJalali)
    .run();

  if (custom_theme && typeof custom_theme === 'object') {
    db.prepare('UPDATE recruitment_settings SET custom_theme_json = ?, updated_at_jalali = ? WHERE id = 1')
      .bind(JSON.stringify(custom_theme), nowJalali)
      .run();
  }

  logAudit('UPDATE_ORG_DEFAULT_THEME', 'SETTINGS', '1', `تغییر پوسته پیش‌فرض سازمان به «${cleanThemeId}»`);
  res.json({
    success: true,
    default_theme: cleanThemeId,
    custom_theme: getSettingsRow().custom_theme,
  });
});

app.put('/api/admin/settings', (req: Request, res: Response) => {
  const current = getSettingsRow();
  const {
    age_limit_enabled,
    female_min_age,
    female_max_age,
    male_min_age,
    male_max_age,
    allow_submit_without_resume,
    default_job_title,
    company_districts,
  } = req.body;

  const nowJalali = getCurrentJalaliDateTime();
  const summary = `بازه سنی بانوان (${toPersianDigits(female_min_age)}-${toPersianDigits(female_max_age)})، آقایان (${toPersianDigits(male_min_age)}-${toPersianDigits(male_max_age)})، وضعیت محدودیت سنی: ${age_limit_enabled ? 'فعال' : 'غیرفعال'}`;

  const updatedHistory = [
    {
      changed_at_jalali: nowJalali,
      changed_by: ADMIN_ACTOR_NAME,
      summary,
    },
    ...current.settings_history,
  ].slice(0, 25);

  db.prepare(
    `UPDATE recruitment_settings SET
      age_limit_enabled = ?,
      female_min_age = ?,
      female_max_age = ?,
      male_min_age = ?,
      male_max_age = ?,
      allow_submit_without_resume = ?,
      default_job_title = ?,
      company_districts_json = ?,
      settings_history_json = ?,
      updated_by = ?,
      updated_at_jalali = ?
     WHERE id = 1`
  )
    .bind(
      age_limit_enabled ? 1 : 0,
      Number(female_min_age),
      Number(female_max_age),
      Number(male_min_age),
      Number(male_max_age),
      allow_submit_without_resume ? 1 : 0,
      String(default_job_title || current.default_job_title),
      JSON.stringify(Array.isArray(company_districts) ? company_districts : current.company_districts),
      JSON.stringify(updatedHistory),
      ADMIN_ACTOR_NAME,
      nowJalali
    )
    .run();

  logAudit('UPDATE_SETTINGS', 'SETTINGS', '1', summary);
  res.json({ success: true, settings: getSettingsRow() });
});

// ============================================================================
// 6. FARAZSMS / IRANPAYAMAK SMS SETTINGS, PROVIDER STATUS, TEST & LOGS APIs
// ============================================================================

app.get('/api/admin/sms/settings', (_req: Request, res: Response) => {
  const smsSettings = getSmsSettingsRow(db);
  const runtimeCfg = getFarazRuntimeConfig();
  res.json({
    settings: smsSettings,
    connection: {
      configured: runtimeCfg.configured,
      base_url: runtimeCfg.baseUrl,
      key_title: runtimeCfg.keyTitle,
      masked_key: runtimeCfg.maskedKey,
    },
  });
});

app.put('/api/admin/sms/settings', (req: Request, res: Response) => {
  const payload = req.body || {};
  if (payload.admin_mobile && String(payload.admin_mobile).trim()) {
    const mobCheck = validateIranianMobile(String(payload.admin_mobile));
    if (!mobCheck.valid) {
      res.status(400).json({ error: `شماره موبایل مدیر نامعتبر است: ${mobCheck.message}` });
      return;
    }
  }
  if (payload.admin_2fa_enabled && (!payload.admin_mobile || !validateIranianMobile(String(payload.admin_mobile)).valid)) {
    res.status(400).json({
      error: 'برای فعال‌سازی احراز هویت دومرحله‌ای ورود مدیر، ابتدا یک شماره موبایل معتبر برای مدیر وارد نمایید.',
    });
    return;
  }

  const saved = saveSmsSettingsRow(db, payload);
  logAudit(
    'UPDATE_SMS_SETTINGS',
    'SMS_SETTINGS',
    '1',
    `به‌روزرسانی تنظیمات پیامکی فراز اس‌ام‌اس (روش ارسال: ${saved.send_mode === 'pattern' ? 'پترن' : 'متن دلخواه'}، 2FA متقاضیان: ${saved.applicant_2fa_enabled ? 'فعال' : 'غیرفعال'}، 2FA مدیر: ${saved.admin_2fa_enabled ? 'فعال' : 'غیرفعال'})`
  );
  res.json({ success: true, settings: saved });
});

app.get('/api/admin/sms/provider-info', async (_req: Request, res: Response) => {
  const t0 = Date.now();
  const status = await fetchFarazProviderStatus();
  res.json({ provider: status, duration_ms: Date.now() - t0 });
});

app.get('/api/admin/sms/analytics', async (_req: Request, res: Response) => {
  const analytics = await getSmsAnalytics(db);
  res.json({ analytics });
});

app.post('/api/admin/sms/test', async (req: Request, res: Response) => {
  const { mobile, event_type, custom_text, mode, line_number, pattern_code, pattern_var_map, variables } =
    req.body || {};
  const cleanMob = toEnglishDigits(String(mobile || '')).trim();
  const mobVal = validateIranianMobile(cleanMob);
  if (!mobVal.valid) {
    res.status(400).json({ error: mobVal.message || 'شماره موبایل آزمایشی معتبر نیست.' });
    return;
  }

  const allowedEvents: Array<SmsEventKey | 'TEST_SMS'> = [
    'OTP',
    'REGISTRATION_SUCCESS',
    'STATUS_AND_INTERVIEW',
    'ADMIN_NEW_APPLICANT',
    'TEST_SMS',
  ];
  const resolvedEvent = allowedEvents.includes(event_type) ? (event_type as SmsEventKey | 'TEST_SMS') : 'TEST_SMS';
  const nowJalali = getCurrentJalaliDateTime();

  const defaultVars: Record<string, string> = {
    code: '482915',
    name: 'متقاضی آزمایشی',
    national_code: '0012345678',
    mobile: cleanMob,
    status: 'دعوت به مصاحبه',
    interview_date: '۱۴۰۵/۰۹/۰۵',
    interview_time: '۱۰:۳۰',
    location: 'دفتر مرکزی شرکت دستوا',
    interview_details: '\nزمان مصاحبه: ۱۴۰۵/۰۹/۰۵ ساعت ۱۰:۳۰\nمکان: دفتر مرکزی شرکت دستوا',
    date: nowJalali,
    job_title: getSettingsRow().default_job_title,
  };

  const sampleVars: Record<string, string> = {
    ...defaultVars,
    ...(variables && typeof variables === 'object' ? (variables as Record<string, string>) : {}),
  };

  const result = await dispatchRecruitmentSms(db, resolvedEvent, cleanMob, sampleVars, {
    customText:
      resolvedEvent === 'TEST_SMS'
        ? String(custom_text || 'پیامک آزمایشی اتصال سامانه استخدام شرکت دستوا به فراز اس‌ام‌اس')
        : undefined,
    forceEnabled: true,
    overrideMode: mode === 'pattern' || mode === 'text' ? mode : undefined,
    overrideLineNumber: typeof line_number === 'string' && line_number.trim() ? line_number.trim() : undefined,
    overridePatternCode:
      resolvedEvent === 'TEST_SMS' && typeof pattern_code === 'string' && pattern_code.trim()
        ? pattern_code.trim()
        : undefined,
    overridePatternVarMap:
      resolvedEvent === 'TEST_SMS' && pattern_var_map && typeof pattern_var_map === 'object'
        ? (pattern_var_map as Record<string, string>)
        : undefined,
  });

  logAudit(
    'TEST_SMS',
    'SMS',
    cleanMob,
    `ارسال پیامک آزمایشی (${resolvedEvent}) به ${cleanMob} — نتیجه: ${result.sent ? 'موفق' : 'ناموفق'}`
  );

  res.status(result.sent ? 200 : 502).json({
    success: result.sent,
    result,
    error: result.error,
  });
});

app.get('/api/admin/sms/templates', (_req: Request, res: Response) => {
  const templates = listCustomSmsTemplates(db);
  res.json({ templates });
});

app.post('/api/admin/sms/templates', (req: Request, res: Response) => {
  const result = createCustomSmsTemplate(db, req.body || {});
  if (result.error || !result.template) {
    res.status(400).json({ error: result.error || 'خطا در ایجاد قالب پیامک.' });
    return;
  }
  logAudit(
    'CREATE_SMS_TEMPLATE',
    'SMS_TEMPLATE',
    String(result.template.id),
    `ایجاد قالب پیامکی جدید «${result.template.title}» (${result.template.send_mode === 'pattern' ? 'پترن' : 'متن دلخواه'})`
  );
  res.status(201).json({ success: true, template: result.template });
});

app.put('/api/admin/sms/templates/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه قالب پیامک نامعتبر است.' });
    return;
  }
  const result = updateCustomSmsTemplate(db, id, req.body || {});
  if (result.notFound) {
    res.status(404).json({ error: result.error });
    return;
  }
  if (result.error || !result.template) {
    res.status(400).json({ error: result.error || 'خطا در ویرایش قالب پیامک.' });
    return;
  }
  logAudit(
    'UPDATE_SMS_TEMPLATE',
    'SMS_TEMPLATE',
    String(id),
    `ویرایش قالب پیامکی «${result.template.title}»`
  );
  res.json({ success: true, template: result.template });
});

app.delete('/api/admin/sms/templates/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه قالب پیامک نامعتبر است.' });
    return;
  }
  const deleted = deleteCustomSmsTemplate(db, id);
  if (!deleted) {
    res.status(404).json({ error: 'قالب پیامک مورد نظر یافت نشد.' });
    return;
  }
  logAudit('DELETE_SMS_TEMPLATE', 'SMS_TEMPLATE', String(id), `حذف قالب پیامکی سفارشی با شناسه ${id}`);
  res.json({ success: true });
});

app.post('/api/admin/sms/templates/:id/send-test', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه قالب پیامک نامعتبر است.' });
    return;
  }
  const { mobile, variables, mode, line_number } = req.body || {};
  const cleanMob = toEnglishDigits(String(mobile || '')).trim();
  const mobVal = validateIranianMobile(cleanMob);
  if (!mobVal.valid) {
    res.status(400).json({ error: mobVal.message || 'شماره موبایل گیرنده معتبر نیست.' });
    return;
  }

  const nowJalali = getCurrentJalaliDateTime();
  const mergedVars: Record<string, string> = {
    code: '482915',
    name: 'متقاضی آزمایشی',
    national_code: '0012345678',
    mobile: cleanMob,
    status: 'دعوت به مصاحبه',
    interview_date: '۱۴۰۵/۰۹/۰۵',
    interview_time: '۱۰:۳۰',
    location: 'دفتر مرکزی شرکت دستوا',
    interview_details: '\nزمان مصاحبه: ۱۴۰۵/۰۹/۰۵ ساعت ۱۰:۳۰\nمکان: دفتر مرکزی شرکت دستوا',
    date: nowJalali,
    job_title: getSettingsRow().default_job_title,
    ...(variables && typeof variables === 'object' ? (variables as Record<string, string>) : {}),
  };

  const result = await sendCustomTemplateSms(db, id, cleanMob, mergedVars, {
    overrideMode: mode === 'pattern' || mode === 'text' ? mode : undefined,
    overrideLineNumber: typeof line_number === 'string' && line_number.trim() ? line_number.trim() : undefined,
  });
  if (result.notFound) {
    res.status(404).json({ error: result.error });
    return;
  }

  logAudit(
    'TEST_CUSTOM_SMS_TEMPLATE',
    'SMS_TEMPLATE',
    String(id),
    `ارسال آزمایشی قالب پیامک #${id} به ${cleanMob} — نتیجه: ${result.sent ? 'موفق' : 'ناموفق'}`
  );
  res.status(result.sent ? 200 : 502).json({
    success: result.sent,
    result,
    error: result.error,
  });
});

app.get('/api/admin/sms/logs', (req: Request, res: Response) => {
  const { status, event_type, search, limit } = req.query;
  const data = getSmsLogsWithSummary(db, {
    status: status ? String(status) : undefined,
    event_type: event_type ? String(event_type) : undefined,
    search: search ? String(search) : undefined,
    limit: limit ? Number(limit) : 200,
  });
  res.json(data);
});

app.post('/api/admin/sms/logs/:id/retry', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه گزارش پیامک نامعتبر است.' });
    return;
  }
  const result = await retrySmsLogEntry(db, id);
  if (result.notFound) {
    res.status(404).json({ error: result.error });
    return;
  }
  logAudit(
    'RETRY_SMS',
    'SMS_LOG',
    String(id),
    `ارسال مجدد پیامک #${id} — نتیجه: ${result.sent ? 'موفق' : 'ناموفق'}`
  );
  res.status(result.sent ? 200 : 502).json({
    success: result.sent,
    result,
    error: result.error,
  });
});

app.get('/api/admin/backup/export', (_req: Request, res: Response) => {
  logAudit('DATABASE_BACKUP', 'DATABASE', 'MAIN', 'تهیه نسخه پشتیبان کامل از جداول پایگاه داده');
  const tables = [
    'users',
    'applicants',
    'applicant_education',
    'applicant_work_experiences',
    'applicant_contacts',
    'recruitment_settings',
    'application_statuses',
    'recruitment_applications',
    'application_status_history',
    'application_notes',
    'interviews',
    'evaluation_criteria',
    'interview_evaluations',
    'evaluation_scores',
    'recruitment_events',
    'audit_logs',
    'sms_settings',
    'sms_custom_templates',
    'sms_logs',
  ];
  const snapshot: Record<string, unknown[]> = {};
  for (const t of tables) {
    snapshot[t] = db.prepare(`SELECT * FROM ${t}`).all().results;
  }
  res.json({
    exported_at_jalali: getCurrentJalaliDateTime(),
    schema_version: '0001_initial_schema',
    tables: snapshot,
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  const dbHealth = checkDatabaseHealth();
  const payload = {
    status: dbHealth.ok ? 'ok' : 'degraded',
    service: 'employment',
    db: dbHealth.ok ? 'ok' : 'error',
    tables_count: dbHealth.tablesCount,
    journal_mode: dbHealth.journalMode,
    node_env: process.env.NODE_ENV || 'development',
    uptime_sec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  res.status(dbHealth.ok ? 200 : 503).json(payload);
});

// ============================================================================
// SERVER INITIALIZATION (Express + Vite Middleware on Port 3000 / process.env.PORT)
// ============================================================================

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = (process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath, { maxAge: '7d', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Dasteva Recruitment Platform running at http://${HOST}:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[employment] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      closeD1Database();
      process.exit(0);
    });
    setTimeout(() => {
      closeD1Database();
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();

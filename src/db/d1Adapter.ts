import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { APPLICATION_STATUS_LIST } from '../types/recruitment.ts';
import { makeValidNationalCode } from '../utils/validation.ts';

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): { results: T[] };
  first<T = Record<string, unknown>>(): T | null;
  run(): { success: boolean; meta: { last_row_id: number; changes: number } };
}

export interface D1DatabaseAdapter {
  prepare(query: string): D1PreparedStatement;
  exec(sqlBatch: string): void;
  getRawSqlite(): Database.Database;
}

class LocalD1Statement implements D1PreparedStatement {
  private stmt: Database.Statement;
  private boundValues: unknown[] = [];

  constructor(stmt: Database.Statement) {
    this.stmt = stmt;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.boundValues = values;
    return this;
  }

  all<T = Record<string, unknown>>(): { results: T[] } {
    const rows = this.stmt.all(...this.boundValues) as T[];
    return { results: rows };
  }

  first<T = Record<string, unknown>>(): T | null {
    const row = this.stmt.get(...this.boundValues) as T | undefined;
    return row ?? null;
  }

  run(): { success: boolean; meta: { last_row_id: number; changes: number } } {
    const info = this.stmt.run(...this.boundValues);
    return {
      success: true,
      meta: {
        last_row_id: Number(info.lastInsertRowid),
        changes: info.changes,
      },
    };
  }
}

class LocalD1Database implements D1DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  prepare(query: string): D1PreparedStatement {
    return new LocalD1Statement(this.db.prepare(query));
  }

  exec(sqlBatch: string): void {
    this.db.exec(sqlBatch);
  }

  getRawSqlite(): Database.Database {
    return this.db;
  }
}

let dbInstance: D1DatabaseAdapter | null = null;

export function getD1Database(): D1DatabaseAdapter {
  if (dbInstance) return dbInstance;

  const dbFilePath = path.resolve(process.cwd(), '.data', 'dasteva_d1.sqlite');
  const adapter = new LocalD1Database(dbFilePath);

  const migrationPath = path.resolve(process.cwd(), 'migrations', '0001_initial_schema.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    adapter.exec(migrationSql);
  }

  seedInitialDataIfNeeded(adapter);
  ensureDefaultSmsSettings(adapter);
  ensureDefaultCustomSmsTemplates(adapter);
  dbInstance = adapter;
  return adapter;
}

function ensureDefaultSmsSettings(db: D1DatabaseAdapter): void {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM sms_settings').first<{ cnt: number }>();
  if (row && row.cnt > 0) return;

  const defaultTemplates = {
    OTP: {
      enabled: true,
      send_mode_override: 'default',
      pattern_code: '',
      pattern_var_map: { code: 'code' },
      text_template: 'کد تایید ورود به سامانه استخدام شرکت دستوا: %code%\nاعتبار کد: ۲ دقیقه',
    },
    REGISTRATION_SUCCESS: {
      enabled: true,
      send_mode_override: 'default',
      pattern_code: '',
      pattern_var_map: { name: 'name', national_code: 'national_code' },
      text_template:
        '%name% عزیز، ثبت‌نام شما در سامانه استخدام شرکت دستوا با موفقیت انجام شد. پیگیری وضعیت پرونده با کد ملی (%national_code%) و شماره موبایل از طریق درگاه سامانه امکان‌پذیر است.',
    },
    STATUS_AND_INTERVIEW: {
      enabled: true,
      send_mode_override: 'default',
      pattern_code: '',
      pattern_var_map: { name: 'name', status: 'status' },
      text_template:
        '%name% گرامی، وضعیت پرونده استخدامی شما در شرکت دستوا به «%status%» تغییر یافت.%interview_details%',
    },
    ADMIN_NEW_APPLICANT: {
      enabled: true,
      send_mode_override: 'default',
      pattern_code: '',
      pattern_var_map: { name: 'name', mobile: 'mobile' },
      text_template:
        'ثبت‌نام متقاضی جدید در سامانه استخدام دستوا:\nنام: %name%\nکد ملی: %national_code%\nموبایل: %mobile%\nزمان: %date%',
    },
  };

  db.prepare(
    `INSERT INTO sms_settings (
      id, sms_enabled, send_mode, line_number, number_format, admin_mobile,
      applicant_2fa_enabled, admin_2fa_enabled, otp_expiry_seconds, otp_resend_seconds,
      templates_json, updated_at_jalali
    ) VALUES (1, 1, 'pattern', '', 'persian', '', 1, 0, 120, 60, ?, '۱۴۰۵/۰۸/۲۵ - ۱۰:۰۰')`
  )
    .bind(JSON.stringify(defaultTemplates))
    .run();

  ensureDefaultCustomSmsTemplates(db);
}

function ensureDefaultCustomSmsTemplates(db: D1DatabaseAdapter): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM sms_custom_templates').first<{ cnt: number }>();
  if (countRow && countRow.cnt > 0) return;

  const starters = [
    {
      title: 'یادآوری ۲۴ ساعته مصاحبه حضوری',
      trigger_key: 'INTERVIEW_REMINDER',
      send_mode: 'text',
      pattern_code: '',
      pattern_var_map: { name: 'name', interview_date: 'interview_date', interview_time: 'interview_time' },
      text_template:
        '%name% گرامی، یادآوری می‌شود جلسه مصاحبه استخدامی شما در شرکت دستوا در تاریخ %interview_date% ساعت %interview_time% در %location% برگزار می‌گردد.',
    },
    {
      title: 'درخواست تکمیل مدارک حضوری',
      trigger_key: 'DOCS_INCOMPLETE',
      send_mode: 'text',
      pattern_code: '',
      pattern_var_map: { name: 'name', national_code: 'national_code' },
      text_template:
        '%name% عزیز، مدارک پرونده استخدامی شما (کد ملی %national_code%) دارای نقص می‌باشد. لطفاً جهت تکمیل مدارک در ساعات اداری ۸ الی ۱۴ به دفتر شرکت دستوا مراجعه فرمایید.',
    },
  ];

  for (const item of starters) {
    db.prepare(
      `INSERT INTO sms_custom_templates (
        title, trigger_key, is_active, send_mode, pattern_code, pattern_var_map_json,
        text_template, created_at_jalali, updated_at_jalali
      ) VALUES (?, ?, 1, ?, ?, ?, ?, '۱۴۰۵/۰۸/۲۵ - ۱۰:۰۰', '۱۴۰۵/۰۸/۲۵ - ۱۰:۰۰')`
    )
      .bind(
        item.title,
        item.trigger_key,
        item.send_mode,
        item.pattern_code,
        JSON.stringify(item.pattern_var_map),
        item.text_template
      )
      .run();
  }
}

function seedInitialDataIfNeeded(db: D1DatabaseAdapter): void {
  const existingStatuses = db.prepare('SELECT COUNT(*) as cnt FROM application_statuses').first<{ cnt: number }>();
  if (existingStatuses && existingStatuses.cnt > 0) {
    return;
  }

  const raw = db.getRawSqlite();
  const seedTx = raw.transaction(() => {
    // 1. Seed Single System Admin User
    db.prepare(
      `INSERT INTO users (username, full_name, email, mobile, password_hash, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind('admin', 'مدیر سامانه', 'admin@dasteva.ir', '09161112233', 'hashed_admin_pass', '۱۴۰۵/۰۸/۲۵ - ۰۹:۱۵').run();

    // 2. Seed 12 Application Statuses
    for (const st of APPLICATION_STATUS_LIST) {
      db.prepare(
        'INSERT INTO application_statuses (code, title, step_order, color_variant, is_terminal) VALUES (?, ?, ?, ?, ?)'
      ).bind(st.code, st.title, st.step_order, st.color_variant, st.is_terminal).run();
    }

    // 3. Seed Default Recruitment Settings
    db.prepare(
      `INSERT INTO recruitment_settings (
        id, age_limit_enabled, female_min_age, female_max_age, male_min_age, male_max_age,
        allow_submit_without_resume, default_job_title, company_districts_json, settings_history_json, updated_by, updated_at_jalali
      ) VALUES (1, 1, 21, 34, 22, 36, 1, ?, ?, ?, 'مدیر سامانه', '۱۴۰۵/۰۸/۲۰ - ۱۰:۳۰')`
    ).bind(
      'کارمند اداری و دفتری (ساعت کاری ۸ الی ۱۴)',
      JSON.stringify([
        'مرکز شهر شوشتر',
        'فرهنگیان',
        'کوی نیرو',
        'دروازه',
        'دولت‌آباد',
        'کوی بوستان',
        'بلوار علامه شیخ شوشتری',
        'سایر مناطق',
      ]),
      JSON.stringify([
        {
          changed_at_jalali: '۱۴۰۵/۰۸/۲۰ - ۱۰:۳۰',
          changed_by: 'مدیر سامانه',
          summary: 'تنظیم محدوده سنی مجاز بانوان (۲۱ تا ۳۴ سال) و آقایان (۲۲ تا ۳۶ سال)',
        },
      ])
    ).run();

    // 4. Seed 8 Standard Evaluation Criteria
    const criteriaList = [
      ['COMM_SKILL', 'مهارت ارتباطی و فن بیان', 15, 10, 1],
      ['CONFIDENCE', 'اعتمادبه‌نفس و حضور در جلسه', 10, 10, 2],
      ['ADMIN_ABILITY', 'توانایی انجام امور اداری و مکاتبات', 15, 10, 3],
      ['COMPUTER_SKILL', 'مهارت کامپیوتر (ICDL، آفیس و اتوماسیون)', 15, 10, 4],
      ['LEARNING_POWER', 'قدرت یادگیری و حل مسئله', 10, 10, 5],
      ['RESPONSIBILITY', 'مسئولیت‌پذیری و نظم کاری', 15, 10, 6],
      ['RELEVANT_EXP', 'تجربه کاری مرتبط', 10, 10, 7],
      ['JOB_FIT', 'تناسب کلی با موقعیت شغلی شرکت دستوا', 10, 10, 8],
    ];
    const critIds: number[] = [];
    for (const [code, title, weight, maxScore, order] of criteriaList) {
      const res = db.prepare(
        'INSERT INTO evaluation_criteria (code, title, weight, max_score, display_order) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, title, weight, maxScore, order).run();
      critIds.push(res.meta.last_row_id);
    }

    // 5. Seed Realistic Sample Applicants (with resume_text directly in applicants table)
    const sampleApplicants = [
      {
        first_name: 'نگار',
        last_name: 'موسوی شوشتری',
        national_prefix: '188045219',
        gender: 'زن',
        birth_date_jalali: '1378/06/14',
        birth_year_jalali: 1378,
        calculated_age: 27,
        marital_status: 'مجرد',
        military_status: '',
        father_name: 'سید محمود',
        father_alive_status: 'در قید حیات',
        father_job: 'فرهنگی بازنشسته',
        mobile: '09164112288',
        city: 'شوشتر',
        district: 'فرهنگیان',
        full_address: 'شوشتر، شهرک فرهنگیان، خیابان سعدی، پلاک ۲۴',
        has_work_experience: 1,
        major: 'مهندسی کامپیوتر - نرم‌افزار',
        degree: 'کارشناسی',
        university: 'دانشگاه آزاد اسلامی واحد شوشتر',
        study_city: 'شوشتر',
        gpa: '18.25',
        work: [
          {
            company_name: 'شرکت خدماتی کارون گستر',
            job_title: 'مسئول دفتر و اپراتور سیستم اداری',
            duration_text: '۲ سال و ۴ ماه',
            duration_months: 28,
            responsibilities: 'ثبت نامه‌های اداری در اتوماسیون، تنظیم قراردادها، بایگانی الکترونیک و پاسخگویی مراجعین',
            leaving_reason: 'اتمام پروژه پیمانکاری شرکت',
          },
        ],
        contact: { full_name: 'سید محمود موسوی', relationship: 'پدر', mobile: '09161883300' },
        status_code: 'FINAL_APPROVED',
        acquaintance_source: 'گروه‌های اطلاع‌رسانی دانشگاه آزاد شوشتر',
        acquaintance_note: '',
        proposed_salary_toman: 12500000,
        in_person_docs_status: 'مدارک بررسی شده',
        in_person_docs_received_at_jalali: '۱۴۰۵/۰۸/۲۳ - ۱۱:۲۰',
        in_person_docs_by_user: 'مدیر سامانه',
        in_person_docs_note: 'اصل کارت ملی، شناسنامه و گواهی موقت کارشناسی به صورت حضوری رویت و تطبیق داده شد.',
        submitted_at_jalali: '۱۴۰۵/۰۸/۱۸ - ۱۰:۱۵',
        strengths: 'تسلط عالی بر اکسل و اتوماسیون اداری، فن بیان قوی، سابقه کاری مرتبط در محیط اداری',
        weaknesses: 'نیاز به آشنایی اولیه با نرم‌افزار اختصاصی بایگانی دستوا',
        interview: {
          stage_title: 'مصاحبه تخصصی و ارزیابی عملی آفیس',
          date: '1405/08/22',
          time: '10:00',
          location: 'دفتر مرکزی شرکت دستوا - اتاق جلسات',
          status: 'انجام شده',
          score: 8.9,
          result_summary: 'عملکرد بسیار دقیق در تایپ ده انگشتی و فرمول‌نویسی اکسل. مناسب برای استخدام.',
        },
        scores: [9, 9, 9, 9.5, 9, 9, 8.5, 8.5],
      },
      {
        first_name: 'امیرحسین',
        last_name: 'بهداروند',
        national_prefix: '188123987',
        gender: 'مرد',
        birth_date_jalali: '1375/02/10',
        birth_year_jalali: 1375,
        calculated_age: 30,
        marital_status: 'متأهل',
        military_status: 'دارای کارت پایان خدمت',
        father_name: 'غلامرضا',
        father_alive_status: 'در قید حیات',
        father_job: 'کارمند اداره آبفا',
        mobile: '09165009182',
        city: 'شوشتر',
        district: 'کوی نیرو',
        full_address: 'شوشتر، کوی نیرو، خیابان اصلی، کوچه بهار ۵، پلاک ۱۲',
        has_work_experience: 1,
        major: 'مدیریت بازرگانی',
        degree: 'کارشناسی ارشد',
        university: 'دانشگاه شهید چمران اهواز',
        study_city: 'اهواز',
        gpa: '17.40',
        work: [
          {
            company_name: 'مجتمع کشت و صنعت کارون',
            job_title: 'کارشناس امور اداری و کارگزینی',
            duration_text: '۳ سال',
            duration_months: 36,
            responsibilities: 'تنظیم لیست حضور و غیاب، مکاتبات سازمانی، پیگیری امور بیمه تکمیلی و بایگانی پرونده‌های پرسنلی',
            leaving_reason: 'تمایل به اشتغال در داخل شهر شوشتر و ساعت کاری منظم صبح',
          },
        ],
        contact: { full_name: 'مریم کلانتری', relationship: 'همسر', mobile: '09167004411' },
        status_code: 'HIRED',
        acquaintance_source: 'صفحه اینستاگرام شرکت دستوا',
        acquaintance_note: '',
        proposed_salary_toman: 13800000,
        in_person_docs_status: 'مدارک بررسی شده',
        in_person_docs_received_at_jalali: '۱۴۰۵/۰۸/۲۴ - ۰۹:۳۰',
        in_person_docs_by_user: 'مدیر سامانه',
        in_person_docs_note: 'تمامی مدارک هویتی، کارت پایان خدمت و دانشنامه کارشناسی ارشد تحویل گردید.',
        submitted_at_jalali: '۱۴۰۵/۰۸/۱۶ - ۱۴:۲۰',
        strengths: 'تجربه مستقیم در امور کارگزینی و مکاتبات رسمی، دقت بسیار بالا، تعهد سازمانی عالی',
        weaknesses: 'پیشنهاد حقوق کمی بالاتر از پایه اولیه که با توجه به تجربه ۳ ساله توافق شد',
        interview: {
          stage_title: 'مصاحبه نهایی استخدام',
          date: '1405/08/21',
          time: '11:30',
          location: 'دفتر مرکزی شرکت دستوا - اتاق مدیریت',
          status: 'انجام شده',
          score: 9.3,
          result_summary: 'تأیید نهایی جهت شروع همکاری از اول آذرماه در واحد اداری.',
        },
        scores: [9.5, 9, 9.5, 9, 9, 9.5, 9.5, 9.5],
      },
      {
        first_name: 'مهسا',
        last_name: 'طاهری زاده',
        national_prefix: '174098321',
        gender: 'زن',
        birth_date_jalali: '1380/09/25',
        birth_year_jalali: 1380,
        calculated_age: 24,
        marital_status: 'مجرد',
        military_status: '',
        father_name: 'فریدون',
        father_alive_status: 'در قید حیات',
        father_job: 'آزاد (فروشگاه لوازم خانگی)',
        mobile: '09368114590',
        city: 'شوشتر',
        district: 'مرکز شهر شوشتر',
        full_address: 'شوشتر، خیابان طالقانی، جنب بانک ملی، مجتمع مسکونی اروند، واحد ۴',
        has_work_experience: 1,
        major: 'حسابداری',
        degree: 'کارشناسی',
        university: 'دانشگاه آزاد اسلامی واحد شوشتر',
        study_city: 'شوشتر',
        gpa: '17.90',
        work: [
          {
            company_name: 'دفتر پیشخوان دولت طالقانی',
            job_title: 'متصدی امور ارباب رجوع و ثبت سیستمی',
            duration_text: '۱ سال و ۶ ماه',
            duration_months: 18,
            responsibilities: 'ثبت درخواست‌های الکترونیکی، اسکن و بایگانی اسناد، پاسخگویی تلفنی و حضوری',
            leaving_reason: 'جستجوی محیط کاری شرکتی با امنیت شغلی و بیمه کامل',
          },
        ],
        contact: { full_name: 'فریدون طاهری زاده', relationship: 'پدر', mobile: '09163118899' },
        status_code: 'INVITED_TO_INTERVIEW',
        acquaintance_source: 'گروه‌های درسی اساتید دانشگاه آزاد شوشتر',
        acquaintance_note: '',
        proposed_salary_toman: 11200000,
        in_person_docs_status: 'دریافت مدارک به صورت حضوری',
        in_person_docs_received_at_jalali: '۱۴۰۵/۰۸/۲۵ - ۰۸:۵۰',
        in_person_docs_by_user: 'مدیر سامانه',
        in_person_docs_note: 'مدارک در روز مراجعه تحویل گرفته شد و در دست بررسی است.',
        submitted_at_jalali: '۱۴۰۵/۰۸/۲۱ - ۱۶:۴۰',
        strengths: 'سرعت عمل بالا در کار با سامانه‌های اینترنتی، آشنایی با امور مالی و اداری',
        weaknesses: 'سابقه کار در شرکت‌های بزرگ ندارد',
        interview: {
          stage_title: 'مصاحبه اولیه استخدامی',
          date: '1405/08/25',
          time: '11:00',
          location: 'دفتر مرکزی شرکت دستوا - اتاق جلسات',
          status: 'زمان‌بندی شده',
          score: 7.8,
          result_summary: 'بررسی اولیه رزومه مثبت ارزیابی شد؛ آماده برگزاری جلسه مصاحبه حضوری.',
        },
        scores: [8, 7.5, 8, 8.5, 8.5, 8, 7, 7.5],
      },
      {
        first_name: 'زهرا',
        last_name: 'مرعشی',
        national_prefix: '188963258',
        gender: 'زن',
        birth_date_jalali: '1382/03/19',
        birth_year_jalali: 1382,
        calculated_age: 23,
        marital_status: 'مجرد',
        military_status: '',
        father_name: 'سید جلال',
        father_alive_status: 'در قید حیات',
        father_job: 'کارمند بانک',
        mobile: '09169012345',
        city: 'شوشتر',
        district: 'دولت‌آباد',
        full_address: 'شوشتر، منطقه دولت‌آباد، خیابان شریعتی، کوچه ۴، پلاک ۱۹',
        has_work_experience: 0,
        major: 'فناوری اطلاعات (IT)',
        degree: 'کارشناسی',
        university: 'دانشگاه آزاد اسلامی واحد شوشتر',
        study_city: 'شوشتر',
        gpa: '18.90',
        work: [],
        contact: { full_name: 'سید جلال مرعشی', relationship: 'پدر', mobile: '09161149988' },
        status_code: 'NEW_APPLICATION',
        acquaintance_source: 'صفحات و کانال‌های فضای مجازی',
        acquaintance_note: '',
        proposed_salary_toman: 10500000,
        in_person_docs_status: 'دریافت نشده',
        in_person_docs_received_at_jalali: '',
        in_person_docs_by_user: '',
        in_person_docs_note: '',
        submitted_at_jalali: '۱۴۰۵/۰۸/۲۵ - ۰۸:۱۰',
        strengths: 'فارغ‌التحصیل ممتاز رشته IT، تسلط بالا بر کامپیوتر و نرم‌افزارهای اداری',
        weaknesses: 'فاقد سابقه کار قبلی',
        interview: {
          stage_title: 'مصاحبه ارزیابی مهارت کامپیوتر و آفیس',
          date: '1405/08/26',
          time: '09:30',
          location: 'دفتر مرکزی شرکت دستوا - اتاق جلسات',
          status: 'زمان‌بندی شده',
          score: 0,
          result_summary: '',
        },
        scores: [],
      },
      {
        first_name: 'فرشته',
        last_name: 'نوروزی',
        national_prefix: '175824691',
        gender: 'زن',
        birth_date_jalali: '1379/07/08',
        birth_year_jalali: 1379,
        calculated_age: 26,
        marital_status: 'متأهل',
        military_status: '',
        father_name: 'منصور',
        father_alive_status: 'در قید حیات',
        father_job: 'بازنشسته شرکت نفت',
        mobile: '09163216549',
        city: 'شوشتر',
        district: 'کوی بوستان',
        full_address: 'شوشتر، کوی بوستان، بلوار نیایش، پلاک ۵۶',
        has_work_experience: 1,
        major: 'مهندسی صنایع',
        degree: 'کارشناسی',
        university: 'دانشگاه صنعتی جندی‌شاپور دزفول',
        study_city: 'دزفول',
        gpa: '17.15',
        work: [
          {
            company_name: 'کلینیک تخصصی مهر شوشتر',
            job_title: 'مسئول پذیرش و هماهنگی اداری',
            duration_text: '۱ سال و ۲ ماه',
            duration_months: 14,
            responsibilities: 'نوبت‌دهی سیستمی، تنظیم گزارش‌های روزانه و بایگانی پرونده‌ها',
            leaving_reason: 'تغییر ساعت کاری کلینیک به شیفت عصر',
          },
        ],
        contact: { full_name: 'آرش کریمی', relationship: 'همسر', mobile: '09164445566' },
        status_code: 'INTERVIEW_COMPLETED',
        acquaintance_source: 'آشنایان و فامیل',
        acquaintance_note: '',
        proposed_salary_toman: 12000000,
        in_person_docs_status: 'مدارک ناقص',
        in_person_docs_received_at_jalali: '۱۴۰۵/۰۸/۲۴ - ۱۲:۰۰',
        in_person_docs_by_user: 'مدیر سامانه',
        in_person_docs_note: 'کارت ملی و شناسنامه رویت شد؛ گواهی پایان تحصیلات دانشگاهی باید در مراجعه بعدی ارائه شود.',
        submitted_at_jalali: '۱۴۰۵/۰۸/۱۹ - ۱۱:۳۰',
        strengths: 'تسلط بر مستندسازی فرآیندها، نظم فردی بالا، تناسب کامل با ساعت کاری ۸ الی ۱۴',
        weaknesses: 'نقص مدرک تحصیلی در تحویل حضوری که در حال پیگیری است',
        interview: {
          stage_title: 'مصاحبه تخصصی اداری',
          date: '1405/08/24',
          time: '10:30',
          location: 'دفتر مرکزی شرکت دستوا - اتاق جلسات',
          status: 'انجام شده',
          score: 8.4,
          result_summary: 'امتیاز بسیار خوب در نظم اداری و گزارش‌نویسی؛ منتظر تکمیل مدرک تحصیلی.',
        },
        scores: [8.5, 8.5, 8.5, 8, 8.5, 9, 8, 8.5],
      },
    ];

    for (const item of sampleApplicants) {
      const validNatCode = makeValidNationalCode(item.national_prefix);
      const sampleResumeText = `خلاصه رزومه و توانمندی‌ها: فارغ‌التحصیل مقطع ${item.degree} رشته ${item.major} از ${item.university} با معدل ${item.gpa}.\nمهارت‌های کامپیوتری و اداری: تسلط کامل بر مجموعه نرم‌افزارهای Microsoft Office (Word، Excel، PowerPoint)، تایپ ده انگشتی فارسی و انگلیسی، آشنایی کامل با اتوماسیون اداری، بایگانی اسناد و مکاتبات رسمی سازمانی.\n${
        item.work.length > 0
          ? `سوابق اجرایی: ${item.work[0].duration_text} سابقه فعالیت به عنوان «${item.work[0].job_title}» در «${item.work[0].company_name}» (${item.work[0].responsibilities}).`
          : 'توانمندی‌های فردی: دقت و سرعت عمل بالا در ثبت اطلاعات سیستمی، روابط عمومی قوی در پاسخگویی به مراجعین و آمادگی کامل برای همکاری در ساعت کاری ۸ الی ۱۴.'
      }`;

      const appRes = db.prepare(
        `INSERT INTO applicants (
          first_name, last_name, national_code, gender, birth_date_jalali, birth_year_jalali,
          calculated_age, marital_status, military_status, father_name, father_alive_status,
          father_job, mobile, city, district, district_input_mode, full_address, has_work_experience, resume_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'list', ?, ?, ?)`
      ).bind(
        item.first_name,
        item.last_name,
        validNatCode,
        item.gender,
        item.birth_date_jalali,
        item.birth_year_jalali,
        item.calculated_age,
        item.marital_status,
        item.military_status,
        item.father_name,
        item.father_alive_status,
        item.father_job,
        item.mobile,
        item.city,
        item.district,
        item.full_address,
        item.has_work_experience,
        sampleResumeText
      ).run();

      const applicantId = appRes.meta.last_row_id;

      // Education
      db.prepare(
        `INSERT INTO applicant_education (
          applicant_id, major, degree_level, university_name, study_city, gpa, graduation_year, is_primary
        ) VALUES (?, ?, ?, ?, ?, ?, '1402', 1)`
      ).bind(applicantId, item.major, item.degree, item.university, item.study_city, item.gpa).run();

      // Work Experience
      for (const w of item.work) {
        db.prepare(
          `INSERT INTO applicant_work_experiences (
            applicant_id, company_name, job_title, duration_text, duration_months, responsibilities, leaving_reason, is_relevant
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
        ).bind(
          applicantId,
          w.company_name,
          w.job_title,
          w.duration_text,
          w.duration_months,
          w.responsibilities,
          w.leaving_reason
        ).run();
      }

      // Contacts
      db.prepare(
        'INSERT INTO applicant_contacts (applicant_id, full_name, relationship, mobile) VALUES (?, ?, ?, ?)'
      ).bind(applicantId, item.contact.full_name, item.contact.relationship, item.contact.mobile).run();

      // Application Dossier
      const recAppRes = db.prepare(
        `INSERT INTO recruitment_applications (
          applicant_id, status_code, current_step, completion_percent, is_submitted,
          acquaintance_source, acquaintance_note, proposed_salary_toman,
          in_person_docs_status, in_person_docs_received_at_jalali, in_person_docs_by_user, in_person_docs_note,
          strengths_summary, weaknesses_summary, submitted_at_jalali, created_at_jalali, updated_at_jalali
        ) VALUES (?, ?, 9, 100, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        applicantId,
        item.status_code,
        item.acquaintance_source,
        item.acquaintance_note,
        item.proposed_salary_toman,
        item.in_person_docs_status,
        item.in_person_docs_received_at_jalali,
        item.in_person_docs_by_user,
        item.in_person_docs_note,
        item.strengths,
        item.weaknesses,
        item.submitted_at_jalali,
        item.submitted_at_jalali,
        '۱۴۰۵/۰۸/۲۵ - ۰۹:۰۰'
      ).run();

      const applicationId = recAppRes.meta.last_row_id;

      // Status History & Timeline Events
      db.prepare(
        `INSERT INTO application_status_history (
          application_id, previous_status_code, new_status_code, reason, changed_by_name, changed_at_jalali
        ) VALUES (?, 'NEW_APPLICATION', ?, 'بررسی و گردش کار پرونده', 'مدیر سامانه', ?)`
      ).bind(applicationId, item.status_code, item.submitted_at_jalali).run();

      db.prepare(
        `INSERT INTO recruitment_events (
          application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
        ) VALUES (?, 'SUBMITTED', 'ثبت نهایی درخواست استخدام', ?, ?, '', 'ثبت درخواست جدید', ?)`
      ).bind(
        applicationId,
        'فرم ۹ مرحله‌ای استخدام تکمیل و ثبت نهایی شد.',
        `${item.first_name} ${item.last_name}`,
        item.submitted_at_jalali
      ).run();

      if (item.status_code !== 'NEW_APPLICATION') {
        const statusTitle = APPLICATION_STATUS_LIST.find((s) => s.code === item.status_code)?.title || item.status_code;
        db.prepare(
          `INSERT INTO recruitment_events (
            application_id, event_type, title, description, actor_name, previous_status, new_status, event_date_jalali
          ) VALUES (?, 'STATUS_CHANGE', 'به‌روزرسانی وضعیت پرونده', ?, 'مدیر سامانه', 'ثبت درخواست جدید', ?, '۱۴۰۵/۰۸/۲۲ - ۱۰:۰۰')`
        ).bind(applicationId, `وضعیت پرونده پس از بررسی به «${statusTitle}» تغییر یافت.`, statusTitle).run();
      }

      // Internal Note
      db.prepare(
        `INSERT INTO application_notes (
          application_id, author_name, note_text, created_at_jalali
        ) VALUES (?, 'مدیر سامانه', ?, '۱۴۰۵/۰۸/۲۲ - ۱۲:۳۰')`
      ).bind(applicationId, `نقاط قوت: ${item.strengths}. ${item.weaknesses}`).run();

      // Interview & Evaluation
      let interviewId: number | null = null;
      if (item.interview) {
        const ivRes = db.prepare(
          `INSERT INTO interviews (
            application_id, stage_number, stage_title, interview_date_jalali, interview_time,
            duration_minutes, location, interviewer_name, status,
            description, result_summary, recommendation, overall_score, created_by_name, created_at_jalali
          ) VALUES (?, 1, ?, ?, ?, 45, ?, 'مدیر سامانه', ?, 'مصاحبه حضوری جهت سنجش مهارت‌های اداری و ارتباطی', ?, 'مناسب جهت همکاری', ?, 'مدیر سامانه', '۱۴۰۵/۰۸/۲۰ - ۱۳:۰۰')`
        ).bind(
          applicationId,
          item.interview.stage_title,
          item.interview.date,
          item.interview.time,
          item.interview.location,
          item.interview.status,
          item.interview.result_summary,
          item.interview.score
        ).run();
        interviewId = ivRes.meta.last_row_id;
      }

      if (item.scores.length === criteriaList.length) {
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < criteriaList.length; i++) {
          const w = Number(criteriaList[i][2]);
          weightedSum += item.scores[i] * w;
          totalWeight += w;
        }
        const finalWeighted = Number(((weightedSum / totalWeight) * 10).toFixed(1));

        const evRes = db.prepare(
          `INSERT INTO interview_evaluations (
            application_id, interview_id, evaluation_type, evaluator_name,
            total_weighted_score, strengths, weaknesses, general_comment, evaluated_at_jalali
          ) VALUES (?, ?, 'INTERVIEW', 'مدیر سامانه', ?, ?, ?, 'ارزیابی شاخص‌های ۸ گانه استخدامی شرکت دستوا', '۱۴۰۵/۰۸/۲۳ - ۱۴:۰۰')`
        ).bind(
          applicationId,
          interviewId,
          finalWeighted,
          item.strengths,
          item.weaknesses
        ).run();

        const evalId = evRes.meta.last_row_id;
        for (let i = 0; i < criteriaList.length; i++) {
          db.prepare(
            `INSERT INTO evaluation_scores (
              evaluation_id, criterion_id, criterion_title, score, max_score, weight, note
            ) VALUES (?, ?, ?, ?, 10, ?, 'مورد تأیید')`
          ).bind(evalId, critIds[i], String(criteriaList[i][1]), item.scores[i], Number(criteriaList[i][2])).run();
        }
      }
    }

    // Seed Audit Log
    db.prepare(
      `INSERT INTO audit_logs (actor_name, action_type, target_entity, target_id, details, created_at_jalali)
       VALUES ('مدیر سامانه', 'SYSTEM_INIT', 'DATABASE', 'MAIN', 'راه‌اندازی اولیه پایگاه داده و بارگذاری شاخص‌های استاندارد استخدام شرکت دستوا', '۱۴۰۵/۰۸/۲۰ - ۰۸:۰۰')`
    ).run();
  });

  seedTx();
}

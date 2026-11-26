# گزارش فنی، معماری استقرار و راهنمای عملیاتی سامانه Employment روی Ubuntu

این سند، مرجع کامل فنی و عملیاتی برای نصب مستقیم (بدون Docker)، پیکربندی، پایش، پشتیبان‌گیری، به‌روزرسانی مستقیم از GitHub و بازگشت به نسخه قبلی (Rollback) سامانه **Employment** (سامانه جامع استخدام شرکت دستوا) روی سرور **Ubuntu LTS (22.04 / 24.04)** است. تمام اطلاعات این سند مبتنی بر بررسی مستقیم سورس واقعی مخزن `https://github.com/khalildelavaran/employment` تهیه شده است.

---

## بخش ۱: گزارش کامل بررسی فنی پروژه

> **یادداشت دسترسی به مخزن خصوصی:** مخزن `https://github.com/khalildelavaran/employment` به صورت **Private** تنظیم شده است. برای دسترسی سرور Ubuntu به مخزن بدون نیاز به ذخیره توکن یا رمز عبور، اسکریپت نصب به صورت خودکار یک **SSH Deploy Key (نوع ed25519 و فقط‌خواندنی)** تولید می‌کند که باید یک‌بار در بخش *Deploy Keys* مخزن GitHub ثبت شود.

### ۱.۱ ساختار کامل دایرکتوری‌ها و فایل‌های پروژه

```text
employment/
├── index.html                           # نقطه ورود HTML برنامه (RTL فارسی، فونت Vazirmatn)
├── package.json                         # تعریف اسکریپت‌ها و وابستگی‌های Backend و Frontend
├── bun.lock                             # فایل قفل وابستگی‌ها (نصب در Ubuntu با npm انجام می‌شود)
├── tsconfig.json                        # تنظیمات کامپایلر TypeScript (ES2022, ESNext, bundler)
├── vite.config.ts                       # تنظیمات Build فرانت‌اند (React + Tailwind v4 + کپی src/assets)
├── server.ts                            # سرور یکپارچه Express (۴۵ مسیر REST API + سرویس‌دهی dist در Production)
├── metadata.json                        # فراداده اپلیکیشن
├── .env.example                         # الگوی متغیرهای محیطی (بدون اسرار)
├── wrangler.jsonc / wrangler.toml       # تنظیمات اختیاری Cloudflare D1 (برای استقرار Ubuntu مورد نیاز نیست)
├── .github/workflows/ci-cd.yml          # پایپ‌لاین CI (تست TypeScript، Build و بررسی Migration با Node 22)
├── migrations/
│   └── 0001_initial_schema.sql          # اسکیمای کامل SQLite شامل ۱۹ جدول و ۱۴ ایندکس
├── scripts/
│   └── migrate-db.ts                    # اسکریپت مستقل و Idempotent اجرای Migrationهای پایگاه داده
├── deploy/
│   ├── install-employment.sh            # اسکریپت کامل نصب خودکار روی Ubuntu
│   ├── update-employment.sh             # اسکریپت مستقل به‌روزرسانی از GitHub و Rollback
│   ├── DEPLOYMENT_GUIDE.md              # همین سند جامع استقرار و بهره‌برداری
│   └── templates/
│       ├── employment.env.example       # نمونه فایل محیطی Production
│       ├── employment.service.example   # نمونه سرویس سخت‌سازی‌شده systemd
│       └── nginx-employment.conf.example# نمونه پیکربندی Nginx Reverse Proxy
└── src/
    ├── main.tsx                         # نقطه ورود React 19
    ├── App.tsx                          # شل اصلی اپلیکیشن (پرتال متقاضی + پنل مدیریت)
    ├── index.css                        # استایل سراسری Tailwind CSS v4
    ├── db/
    │   └── d1Adapter.ts                 # آداپتور SQLite (better-sqlite3، حالت WAL، Migration و Health Check)
    ├── services/
    │   └── farazSmsService.ts           # کلاینت سمت سرور وب‌سرویس پیامکی فراز اس‌ام‌اس / ایران‌پیامک
    ├── types/
    │   └── recruitment.ts               # مدل‌ها و قراردادهای TypeScript کل سامانه
    ├── theme/
    │   └── presets.ts                   # پوسته‌ها و توکن‌های ظاهری
    ├── utils/
    │   └── validation.ts                # اعتبارسنجی کد ملی، موبایل ایران، تاریخ جلالی و ارقام فارسی
    └── components/
        ├── ApplicantPortal.tsx          # فرم ثبت‌نام متقاضی، OTP و پیگیری وضعیت
        ├── AdminModulesPart1.tsx        # مدیریت پرونده‌ها، مصاحبه‌ها و امتیازدهی
        ├── AdminModulesPart2.tsx        # تنظیمات استخدامی، گزارش ممیزی و پشتیبان‌گیری JSON
        ├── AnalyticsDashboardView.tsx   # داشبورد تحلیلی استخدام
        ├── DossierDrawerModal.tsx       # جزئیات پرونده متقاضی
        ├── PrintReportModal.tsx         # نسخه چاپی پرونده‌ها
        ├── SmsSettingsView.tsx          # مدیریت ۵تب پیامک (داشبورد، تست، اتصال، قالب‌ها، لاگ‌ها)
        ├── SmsAnalyticsDashboardTab.tsx # داشبورد تحلیلی حجم/هزینه/تعرفه پیامک
        ├── SmsTestSandboxTab.tsx        # محیط تست ارسال و بررسی اتصال API پیامک
        └── ThemeGalleryView.tsx         # گالری انتخاب و شخصی‌سازی پوسته
```

### ۱.۲ فناوری‌ها، زبان‌ها و فریم‌ورک‌ها
- **معماری کلی:** پروژه یک **Full-Stack TypeScript Monorepo** یکپارچه با ماژولاریتی استاندارد ESM (`"type": "module"`) است.
- **Backend:**
  - فریم‌ورک `Express 4.21.2` در فایل `server.ts` شامل ۴۵ مسیر REST API (`/api/public/*`، `/api/admin/*`، `/api/v1/*`، `/api/health`).
  - اجرای TypeScript سمت سرور با `tsx` (`^4.21.0`) روی **Node.js 22 LTS**.
  - سقف اندازه درخواست JSON معادل `10mb` (برای پشتیبانی از ارسال رزومه/تصویر Base64).
  - محدودیت نرخ درخواست (Rate Limiter) درون‌حافظه‌ای روی مسیرهای استعلام متقاضی با پشتیبانی `app.set('trust proxy', 1)` پشت Nginx.
- **Frontend:**
  - `React 19.0.1` + `React DOM 19.0.1`
  - `Vite 8.3.0` + `@vitejs/plugin-react 6.1.1`
  - `Tailwind CSS 4.3.3` + `@tailwindcss/vite 4.3.3`
  - کتابخانه‌های رابط کاربری و نمودار: `recharts 3.10.1`، `lucide-react 0.546.0`، `motion 12.23.24`، `xlsx 0.18.5` (خروجی اکسل).

### ۱.۳ نسخه دقیق Runtimeها، ابزارها و کتابخانه‌های مورد نیاز

| لایه | ابزار / بسته | نسخه دقیق / مورد نیاز | توضیح کاربردی |
| :--- | :--- | :--- | :--- |
| سیستم‌عامل | Ubuntu Server LTS | `22.04 LTS` یا `24.04 LTS` (`amd64` / `arm64`) | سیستم‌عامل پایه سرور |
| Runtime | Node.js | `22.x LTS` (پیشنهادی: `22.14+` تا آخرین `22.x`) | هم‌خوان با CI پروژه و `better-sqlite3` |
| مدیر بسته | npm | `10.x` (همراه Node.js 22 LTS) | نصب وابستگی‌ها و اجرای اسکریپت‌ها |
| ابزار Build بومی | `build-essential`, `python3`, `make`, `g++` | نسخه مخزن رسمی Ubuntu | الزامی برای کامپایل ماژول بومی C++ (`better-sqlite3`) |
| ابزار پایگاه داده | `sqlite3` CLI | `3.37+` (مخزن رسمی Ubuntu) | پشتیبان‌گیری آنلاین ایمن (`.backup`) و بررسی سلامت (`PRAGMA integrity_check`) |
| وب‌سرور و پروکسی | `nginx` | نسخه رسمی Ubuntu | Reverse Proxy، فشرده‌سازی Gzip و هدرهای امنیتی |
| گواهی TLS (اختیاری) | `certbot` + `python3-certbot-nginx` | نسخه رسمی Ubuntu | صدور و تمدید خودکار گواهی SSL از Let's Encrypt |
| کنترل نسخه و SSH | `git`, `openssh-client` | نسخه رسمی Ubuntu | دریافت امن سورس از مخزن خصوصی با Deploy Key |
| فایروال | `ufw` | نسخه رسمی Ubuntu | محدودسازی دسترسی ورودی به SSH (22) و HTTP/HTTPS (80/443) |
| کتابخانه‌های Production (`package.json`) | `express@^4.21.2`, `better-sqlite3@^13.2.0`, `dotenv@^17.2.3`, `react@^19.0.1`, `react-dom@^19.0.1`, `vite@^8.3.0`, `@vitejs/plugin-react@^6.1.1`, `@tailwindcss/vite@^4.3.3`, `recharts@^3.10.1`, `lucide-react@^0.546.0`, `motion@^12.23.24`, `xlsx@^0.18.5`, `@google/genai@^2.4.0` | مطابق `package.json` | توجه: `@google/genai` در `package.json` وجود دارد اما در حال حاضر در هیچ ماژولی Import نشده و نیازی به `GEMINI_API_KEY` برای اجرا نیست |
| ابزارهای توسعه و اجرا (`devDependencies`) | `tsx@^4.21.0`, `typescript@^7.0.2`, `tailwindcss@^4.3.3`, `esbuild@^0.25.0`, `autoprefixer@^10.4.21`, `@types/*` | مطابق `package.json` | `tsx` برای اجرای `server.ts` و `scripts/migrate-db.ts` و `vite`/`tailwindcss` برای Build لازم هستند |

### ۱.۴ پایگاه داده، نحوه اتصال و الزامات راه‌اندازی
- **نوع پایگاه داده:** **SQLite 3** تعبیه‌شده (Embedded) از طریق کتابخانه پرسرعت `better-sqlite3`. هیچ سرور پایگاه داده مستقلی (مانند PostgreSQL یا MySQL) در پروژه استفاده **نشده** است.
- **تنظیمات کلیدی SQLite:**
  - حالت `PRAGMA journal_mode = WAL;` برای هم‌زمانی بالا در خواندن/نوشتن و پشتیبان‌گیری بدون قفل‌کردن کاربران.
  - فعال‌سازی `PRAGMA foreign_keys = ON;` برای یکپارچگی ارجاعی.
- **مسیر ذخیره فایل دیتابیس:**
  - در محیط توسعه (بدون تنظیم `DB_PATH`): `./.data/dasteva_d1.sqlite`
  - در محیط Production Ubuntu (با متغیر `DB_PATH`): `/var/lib/employment/data/dasteva_d1.sqlite` (کاملاً جدا از سورس Git).
- **ساختار جداول (۱۹ جدول + جدول پیگیری `schema_migrations`):**
  - `users`، `applicants`، `applicant_education`، `applicant_work_experiences`، `applicant_contacts`، `recruitment_settings`، `application_statuses`، `recruitment_applications`، `application_status_history`، `application_notes`، `interviews`، `evaluation_criteria`، `interview_evaluations`، `evaluation_scores`، `recruitment_events`، `audit_logs`، `sms_settings`، `otp_verifications`، `sms_logs`، `sms_custom_templates` و `schema_migrations`.
- **الزامات Migration:** اسکریپت `npm run db:migrate` فایل‌های `migrations/*.sql` را به ترتیب الفبایی به صورت اتمیک (داخل تراکنش) اجرا و در جدول `schema_migrations` ثبت می‌کند تا در به‌روزرسانی‌های آینده هیچ Migrationای دوبار اجرا نشود.

### ۱.۵ نحوه ارتباط Frontend و Backend
- در حالت توسعه (`NODE_ENV != production`)، `server.ts` میدل‌ویر `Vite` را متصل می‌کند.
- در حالت عملیاتی (`NODE_ENV=production`)، خروجی Buildشده فرانت‌اند در پوشه `dist/` مستقیماً توسط Express (`express.static` + fallback به `dist/index.html` برای SPA) سرویس‌دهی می‌شود و تمامی درخواست‌های `/api/*` از همان مبدا (Same-Origin) بدون نیاز به باز کردن CORS پاسخ داده می‌شوند.
- کل این سرویس پشت **Nginx Reverse Proxy** قرار می‌گیرد.

### ۱.۶ متغیرهای محیطی و تنظیمات مورد نیاز

| متغیر | الزامی؟ | مقدار پیشنهادی Production | توضیح |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | بله | `production` | غیرفعال‌سازی Vite Dev Server و سرو مستقیم `dist/` |
| `HOST` | بله | `127.0.0.1` | محدودسازی گوش‌دادن Express فقط به Loopback پشت Nginx |
| `PORT` | بله | `3000` | پورت داخلی Express (قابل تنظیم در اسکریپت نصب) |
| `DB_PATH` | بله | `/var/lib/employment/data/dasteva_d1.sqlite` | مسیر مستقل دیتابیس خارج از مخزن Git |
| `APP_URL` | توصیه‌شده | `https://profile.dastva.co` | نشانی عمومی سامانه |
| `FARAZSMS_BASE_URL` | اختیاری | `https://api.iranpayamak.com` | آدرس پایه وب‌سرویس فراز اس‌ام‌اس |
| `FARAZSMS_API_KEY` | اختیاری (برای پیامک) | کلید واقعی پنل فراز اس‌ام‌اس | فقط سمت سرور خوانده می‌شود (`Api-Key` header) |
| `FARAZSMS_KEY_TITLE` | اختیاری | `emloyment` | عنوان کلید نمایش‌داده‌شده در تب اتصال پنل |
| `FARAZSMS_LINE_NUMBER` | اختیاری | خط اختصاصی/خدماتی | شماره خط پیش‌فرض فرستنده (در پنل ادمین هم قابل ویرایش است) |
| `GEMINI_API_KEY` | خیر | *(خالی)* | در نسخه فعلی استفاده نمی‌شود |

### ۱.۷ پورت‌ها، سرویس‌ها و الزامات شبکه
- **ورودی بیرونی (فایروال UFW):**
  - `22/tcp` (OpenSSH — مدیریت سرور)
  - `80/tcp` (Nginx HTTP — و ریدایرکت به HTTPS در صورت فعال‌سازی SSL)
  - `443/tcp` (Nginx HTTPS — در صورت فعال‌سازی Certbot)
- **پورت داخلی (فقط Loopback):**
  - `127.0.0.1:3000` (سرویس `employment.service` — از اینترنت مستقیماً در دسترس **نیست**)
- **خروجی بیرونی (Outbound HTTPS/SSH):**
  - `github.com:22` (SSH برای دریافت سورس و به‌روزرسانی)
  - `deb.nodesource.com:443` و مخازن Ubuntu (فقط هنگام نصب)
  - `api.iranpayamak.com:443` (برای ارسال پیامک و دریافت مانده اعتبار فراز اس‌ام‌اس)
  - `acme-v02.api.letsencrypt.org:443` (فقط در صورت استفاده از Certbot HTTPS)

### ۱.۸ دستورات صحیح نصب، Build، اجرا و تست

```bash
# نصب وابستگی‌ها
npm install --no-audit --no-fund

# بررسی سینتکس و تایپ‌های TypeScript
npm run lint

# Build نسخه Production فرانت‌اند (تولید پوشه dist/)
NODE_ENV=production npm run build

# اجرای کنترل‌شده Migrationهای پایگاه داده
npm run db:migrate

# اجرای Production سرور (توسط systemd اجرا می‌شود)
NODE_ENV=production ./node_modules/.bin/tsx server.ts

# تست سلامت زنده سامانه و پایگاه داده
curl -fsS http://127.0.0.1:3000/api/health
```

### ۱.۹ ملاحظات امنیتی و اجرای Production
1. **عدم اجرا با کاربر Root:** سرویس تحت کاربر سیستمی کم‌امتیاز `employment` با Shell غیرفعال (`/usr/sbin/nologin`) اجرا می‌شود.
2. **سخت‌سازی `systemd`:** اعمال `ProtectSystem=strict`، `ProtectHome=true`، `NoNewPrivileges=true`، `PrivateTmp=true` و محدودسازی دسترسی نوشتن (`ReadWritePaths`) صرفاً به `/var/lib/employment/data`.
3. **حفاظت از کلیدها و اسرار:** فایل `/etc/employment/employment.env` با مالکیت `root:employment` و مجوز `0640` نگهداری می‌شود و خارج از پوشه Git قرار دارد.
4. **کلید SSH فقط‌خواندنی:** کلید `/etc/employment/ssh/deploy_key` با مجوز `0600` و فقط دسترسی `Read-only` در GitHub ثبت می‌شود تا سرور هیچ دسترسی نوشتنی به مخزن کد نداشته باشد.
5. **خاموش‌شدن ایمن (Graceful Shutdown):** دریافت سیگنال `SIGTERM` از `systemd` باعث بسته‌شدن ایمن سرور HTTP و اجرای `PRAGMA wal_checkpoint(TRUNCATE)` روی SQLite پیش از خروج می‌شود.
6. **توصیه عملیاتی مهم برای پنل مدیریت:** در صورت استقرار روی اینترنت عمومی، در لایه Nginx می‌توانید برای مسیرهای `/api/admin/` محدودیت IP دفتر (مثلاً `allow 1.2.3.4; deny all;`) یا احراز هویت دو‌مرحله‌ای پیامکی داخلی سامانه (2FA مدیر در تب تنظیمات پیامک) را فعال کنید.

---

## بخش ۲: ساختار نهایی دایرکتوری‌های نصب روی Ubuntu

| مسیر استاندارد (قابل تغییر با فلگ) | مالکیت | مجوز | محتوا و نقش |
| :--- | :--- | :--- | :--- |
| `/opt/employment/app` | `employment:employment` | `0755` | سورس پروژه کلون‌شده از GitHub، `node_modules/` و خروجی `dist/` |
| `/opt/employment/scripts` | `root:employment` | `0750` | نسخه‌های نصبی `install-employment.sh` و `update-employment.sh` |
| `/usr/local/bin/employment-update` | `root:root` | symlink | میانبر سراسری اجرای اسکریپت به‌روزرسانی |
| `/etc/employment/employment.env` | `root:employment` | `0640` | متغیرهای محیطی و کلیدهای محرمانه (مصون از به‌روزرسانی) |
| `/etc/employment/ssh/` | `root:root` | `0700` | کلید خصوصی `deploy_key` (`0600`)، کلید عمومی و `known_hosts` |
| `/var/lib/employment/data/` | `employment:employment` | `0750` | فایل پایگاه داده `dasteva_d1.sqlite` (`0640`) و فایل‌های `-wal`/`-shm` |
| `/var/lib/employment/install-state.env` | `root:employment` | `0640` | فراداده نصب برای هماهنگی خودکار با اسکریپت به‌روزرسانی |
| `/var/log/employment/` | `root:employment` | `0750` | لاگ‌های نصب، به‌روزرسانی، Rollback و لاگ‌های دسترسی/خطای Nginx |
| `/var/backups/employment/` | `root:employment` | `0750` | Snapshotهای تاریخ‌دار پیش از هر به‌روزرسانی (دیتابیس + تنظیمات + `dist`) |

---

## بخش ۳: دستورالعمل اجرای نصب اولیه روی سرور Ubuntu

### گام ۱: انتقال اسکریپت نصب به سرور Ubuntu
فایل `deploy/install-employment.sh` را به سرور Ubuntu منتقل کنید و مجوز اجرا بدهید:

```bash
chmod +x install-employment.sh
```

### گام ۲: اجرای اسکریپت نصب

- **حالت الف — نصب روی IP سرور (HTTP با Nginx):**
```bash
sudo ./install-employment.sh
```

- **حالت ب — نصب با دامنه اختصاصی و HTTPS خودکار (Let's Encrypt Certbot):**
*(پیش‌شرط: رکورد DNS نوع `A` دامنه به IP سرور اشاره کرده باشد.)*
```bash
sudo ./install-employment.sh \
  --domain profile.dastva.co \
  --enable-ssl \
  --email ops@dastva.co
```

- **حالت ج — نصب با مسیرها و پورت سفارشی:**
```bash
sudo ./install-employment.sh \
  --install-dir /srv/employment \
  --data-dir /srv/employment-data \
  --port 3100 \
  --branch main
```

### گام ۳: ثبت کلید SSH در مخزن خصوصی GitHub (فقط در نصب اول)
هنگام رسیدن اسکریپت به **مرحله ۵/۱۰**، کلید عمومی SSH تولیدشده (`ed25519`) در ترمینال نمایش داده می‌شود:
1. وارد نشانی `https://github.com/khalildelavaran/employment/settings/keys` شوید.
2. روی **Add deploy key** کلیک کنید.
3. یک عنوان دلخواه (مثلاً `ubuntu-prod-server`) وارد کنید، کلید عمومی چاپ‌شده را جای‌گذاری کنید و تیک **Allow write access** را **غیرفعال** بگذارید.
4. پس از ذخیره در GitHub، در ترمینال سرور کلید **Enter** را بزنید تا اسکریپت ادامه یابد و نصب را تا تأیید سلامت تکمیل کند.

### گام ۴: تنظیم کلید وب‌سرویس پیامک (در صورت نیاز)
```bash
sudo nano /etc/employment/employment.env
# مقدار FARAZSMS_API_KEY را وارد و ذخیره کنید، سپس سرویس را ری‌استارت نمایید:
sudo systemctl restart employment
```

---

## بخش ۴: دستورالعمل به‌روزرسانی مستقیم از GitHub

پس از نصب اولیه، هر زمان تغییرات جدیدی روی شاخه `main` در GitHub قرار گرفت:

```bash
# ۱. بررسی تغییرات جدید بدون اعمال هیچ تغییری (Dry-Run)
sudo employment-update --dry-run

# ۲. اجرای کامل به‌روزرسانی (پشتیبان‌گیری خودکار + دریافت کد + Build + Migration + تست سلامت)
sudo employment-update
```

گزینه‌های پرکاربرد دیگر:
- `sudo employment-update --force` — بازسازی و استقرار مجدد حتی اگر Commit تغییر نکرده باشد.
- `sudo employment-update --branch staging` — استقرار از شاخه دیگر.
- `sudo employment-update --keep-backups 15` — نگهداری ۱۵ نسخه پشتیبان آخر (پیش‌فرض: ۱۰).

> **تضمین ایمنی داده‌ها:** در طول به‌روزرسانی، فایل `/etc/employment/employment.env` و مسیر `/var/lib/employment/data/` هرگز حذف یا بازنویسی نمی‌شوند و Build فرانت‌اند پیش از توقف سرویس زنده انجام می‌گیرد.

---

## بخش ۵: بررسی سلامت و پایش وضعیت سرویس‌ها

```bash
# وضعیت سرویس اپلیکیشن
sudo systemctl status employment --no-pager

# وضعیت وب‌سرور Nginx
sudo systemctl status nginx --no-pager

# بررسی اندپوینت سلامت مستقیم (Express + SQLite)
curl -s http://127.0.0.1:3000/api/health | python3 -m json.tool

# مشاهده لاگ زنده اپلیکیشن
sudo journalctl -u employment -f

# مشاهده ۱۰۰ خط آخر لاگ اپلیکیشن
sudo journalctl -u employment -n 100 --no-pager

# مشاهده لاگ‌های Nginx و اسکریپت‌های استقرار
sudo tail -n 50 /var/log/employment/nginx-error.log
ls -lt /var/log/employment/
```

خروجی سالم `GET /api/health`:
```json
{
  "status": "ok",
  "service": "employment",
  "db": "ok",
  "tables_count": 20,
  "journal_mode": "wal",
  "node_env": "production",
  "uptime_sec": 124,
  "timestamp": "2026-11-22T18:00:00.000Z"
}
```

---

## بخش ۶: روش تهیه و بازیابی Backup (دستی و زمان‌بندی‌شده)

### پشتیبان‌گیری دستی و ایمن آنلاین از SQLite (بدون توقف سرویس)
به دلیل استفاده از حالت `WAL`، هرگز از دستور `cp` ساده روی فایل دیتابیس در حال کار استفاده نکنید؛ همیشه از دستور `.backup` ابزار `sqlite3` استفاده کنید:

```bash
BACKUP_FILE="/var/backups/employment/manual-db-$(date '+%Y%m%d-%H%M%S').sqlite"
sudo sqlite3 /var/lib/employment/data/dasteva_d1.sqlite ".timeout 15000" ".backup '${BACKUP_FILE}'"
sudo sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;"
sudo chmod 640 "${BACKUP_FILE}"
```

### زمان‌بندی پشتیبان‌گیری روزانه خودکار (Cron)
برای تهیه پشتیبان روزانه در ساعت ۰۳:۰۰ بامداد و پاک‌سازی فایل‌های قدیمی‌تر از ۳۰ روز:

```bash
sudo tee /etc/cron.d/employment-backup >/dev/null <<'EOF'
0 3 * * * root sqlite3 /var/lib/employment/data/dasteva_d1.sqlite ".timeout 15000" ".backup '/var/backups/employment/daily-$(date +\%Y\%m\%d).sqlite'" && chmod 640 /var/backups/employment/daily-*.sqlite && find /var/backups/employment -maxdepth 1 -name 'daily-*.sqlite' -mtime +30 -delete
EOF
sudo chmod 644 /etc/cron.d/employment-backup
```

### بازیابی دستی پایگاه داده از فایل پشتیبان
```bash
sudo systemctl stop employment
sudo rm -f /var/lib/employment/data/dasteva_d1.sqlite-wal /var/lib/employment/data/dasteva_d1.sqlite-shm
sudo cp /var/backups/employment/manual-db-YYYYMMDD-HHMMSS.sqlite /var/lib/employment/data/dasteva_d1.sqlite
sudo sqlite3 /var/lib/employment/data/dasteva_d1.sqlite "PRAGMA integrity_check;"
sudo chown employment:employment /var/lib/employment/data/dasteva_d1.sqlite
sudo chmod 640 /var/lib/employment/data/dasteva_d1.sqlite
sudo systemctl start employment
curl -fsS http://127.0.0.1:3000/api/health
```

---

## بخش ۷: نحوه بازگشت به نسخه قبلی (Rollback)

### بازگشت خودکار
اگر در حین اجرای `sudo employment-update` مرحله Migration یا بررسی سلامت پس از Restart ناموفق باشد، اسکریپت به صورت خودکار کد، خروجی `dist/` و پایگاه داده را از Snapshot ساخته‌شده پیش از به‌روزرسانی برمی‌گرداند و سلامت سرویس را دوباره تأیید می‌کند.

### بازگشت دستی در هر زمان
```bash
# ۱. مشاهده فهرست Snapshotهای موجود
sudo employment-update --list-backups

# ۲. بازگشت به آخرین Snapshot پیش از آخرین به‌روزرسانی
sudo employment-update --rollback

# ۳. یا بازگشت به یک Snapshot مشخص
sudo employment-update --rollback /var/backups/employment/backup-20261122-140500
```

---

## بخش ۸: عیب‌یابی خطاهای متداول

| نشانه / خطا | علت محتمل | راه‌حل عملیاتی |
| :--- | :--- | :--- |
| توقف یا قفل‌شدن `git clone` در مرحله ۶ (`Cloning into '/opt/employment/app'...`) | مسدود یا فریز شدن ترافیک `git-upload-pack` روی پورت `22` در شبکه دیتاسنتر ایران | نسخه جدید اسکریپت به صورت خودکار از `ssh.github.com` روی پورت `443` استفاده می‌کند (`--github-ssh-port 443`). در صورت استفاده از اسکریپت قبلی، `HostName ssh.github.com` و `Port 443` را در `/etc/employment/ssh/config` قرار دهید |
| `Permission denied (publickey)` هنگام نصب یا آپدیت | کلید عمومی در GitHub Deploy Keys ثبت نشده یا حذف شده است | محتوای `sudo cat /etc/employment/ssh/deploy_key.pub` را بررسی و در بخش Deploy Keys مخزن ثبت کنید؛ سپس تست بگیرید: `sudo ssh -F /etc/employment/ssh/config -T git@github.com` |
| خطای `NODE_MODULE_VERSION` یا `better_sqlite3.node` هنگام استارت | تغییر نسخه Node.js پس از نصب `node_modules` | بازسازی باینری بومی: `sudo -u employment npm --prefix /opt/employment/app rebuild better-sqlite3 && sudo systemctl restart employment` |
| خطای `502 Bad Gateway` در Nginx | سرویس `employment` خاموش است یا روی پورت دیگری گوش می‌دهد | وضعیت سرویس را بررسی کنید (`sudo systemctl status employment`)، پورت `PORT` در `/etc/employment/employment.env` را با `proxy_pass` در `/etc/nginx/sites-available/employment` تطبیق دهید و لاگ را بخوانید (`sudo journalctl -u employment -n 50`) |
| خطای `SQLITE_READONLY` یا `unable to open database file` | تغییر مالکیت یا مجوز پوشه `/var/lib/employment/data` | اصلاح مجوزها: `sudo chown -R employment:employment /var/lib/employment/data && sudo chmod 750 /var/lib/employment/data && sudo chmod 640 /var/lib/employment/data/dasteva_d1.sqlite && sudo systemctl restart employment` |
| خطای `413 Request Entity Too Large` هنگام آپلود رزومه/عکس | حجم فایل ارسالی بیش از سقف Nginx است | در `/etc/nginx/sites-available/employment` مقدار `client_max_body_size 12m;` را بررسی و در صورت تغییر، `sudo nginx -t && sudo systemctl reload nginx` اجرا کنید |
| خطا در صدور گواهی SSL توسط Certbot | رکورد DNS دامنه هنوز به سرور اشاره نکرده یا پورت 80 بسته است | با `dig +short profile.dastva.co` آدرس IP را تأیید و با `sudo ufw status` باز بودن پورت‌های 80 و 443 را بررسی کنید، سپس دستور Certbot را دوباره اجرا نمایید |
| پیامک‌ها ارسال نمی‌شوند یا خطای احراز هویت فراز اس‌ام‌اس رخ می‌دهد | `FARAZSMS_API_KEY` در `/etc/employment/employment.env` خالی یا نامعتبر است | کلید معتبر را در `/etc/employment/employment.env` قرار دهید، `sudo systemctl restart employment` بزنید و از تب «تست ارسال پیامک» اتصال زنده را بررسی کنید |

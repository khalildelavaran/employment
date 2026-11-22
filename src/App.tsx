import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  FilePlus,
  FolderKanban,
  FileSearch,
  GitBranch,
  CalendarCheck,
  Calendar,
  GitCompare,
  Award,
  UserCheck,
  Briefcase,
  BarChart3,
  Settings,
  Palette,
  Menu,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  TrendingUp,
  Lock,
  LogOut,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import {
  ApplicantFullDossier,
  ApplicantSummaryRow,
  InterviewRecord,
} from './types/recruitment.ts';
import { ApplicantPortal } from './components/ApplicantPortal.tsx';
import { AnalyticsDashboardView } from './components/AnalyticsDashboardView.tsx';
import {
  ApplicantsTableView,
  DashboardAnalyticsView,
  DashboardData,
  WorkflowPipelineView,
} from './components/AdminModulesPart1.tsx';
import {
  ComparisonModuleView,
  InterviewsCalendarModuleView,
  SettingsAndUsersView,
} from './components/AdminModulesPart2.tsx';
import { SmsSettingsView } from './components/SmsSettingsView.tsx';
import { DossierDrawerModal } from './components/DossierDrawerModal.tsx';
import { PrintMode, PrintReportModal } from './components/PrintReportModal.tsx';
import { ThemeGalleryModal, ThemeGalleryView } from './components/ThemeGalleryView.tsx';
import {
  ThemePresetId,
  ThemeTokens,
  applyThemeTokensToDocument,
  getPresetById,
  loadSavedThemeFromStorage,
  saveThemeToStorage,
} from './theme/presets.ts';
import { toEnglishDigits, toPersianDigits } from './utils/validation.ts';

type AdminMenuKey =
  | 'DASHBOARD'
  | 'ANALYTICS_DASHBOARD'
  | 'APPLICANTS_ALL'
  | 'APPLICANTS_NEW'
  | 'DOSSIERS_VIEW'
  | 'RESUME_REVIEW'
  | 'WORKFLOW_PIPELINE'
  | 'INTERVIEWS_MANAGE'
  | 'RECRUITMENT_CALENDAR'
  | 'COMPARISON'
  | 'EVALUATIONS'
  | 'APPROVED_APPLICANTS'
  | 'HIRED_APPLICANTS'
  | 'REPORTS_STATS'
  | 'THEME_GALLERY'
  | 'SMS_SETTINGS'
  | 'RECRUITMENT_SETTINGS';

const ADMIN_MENU_ITEMS: Array<{
  key: AdminMenuKey;
  label: string;
  icon: typeof LayoutDashboard;
  presetStatus?: string;
}> = [
  { key: 'DASHBOARD', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'ANALYTICS_DASHBOARD', label: 'داشبورد تحلیلی (Analytics)', icon: TrendingUp },
  { key: 'APPLICANTS_ALL', label: 'متقاضیان استخدام', icon: Users, presetStatus: 'ALL' },
  { key: 'APPLICANTS_NEW', label: 'درخواست‌های جدید', icon: FilePlus, presetStatus: 'NEW_APPLICATION' },
  { key: 'DOSSIERS_VIEW', label: 'پرونده‌های استخدام', icon: FolderKanban, presetStatus: 'ALL' },
  { key: 'RESUME_REVIEW', label: 'بررسی رزومه‌ها', icon: FileSearch, presetStatus: 'RESUME_REVIEWING' },
  { key: 'WORKFLOW_PIPELINE', label: 'گردش کار استخدام', icon: GitBranch },
  { key: 'INTERVIEWS_MANAGE', label: 'مدیریت مصاحبه‌ها', icon: CalendarCheck },
  { key: 'RECRUITMENT_CALENDAR', label: 'تقویم استخدام', icon: Calendar },
  { key: 'COMPARISON', label: 'مقایسه متقاضیان', icon: GitCompare },
  { key: 'EVALUATIONS', label: 'ارزیابی‌ها', icon: Award, presetStatus: 'INTERVIEW_COMPLETED' },
  { key: 'APPROVED_APPLICANTS', label: 'افراد تأییدشده', icon: UserCheck, presetStatus: 'FINAL_APPROVED' },
  { key: 'HIRED_APPLICANTS', label: 'افراد استخدام‌شده', icon: Briefcase, presetStatus: 'HIRED' },
  { key: 'REPORTS_STATS', label: 'گزارش‌ها و آمار', icon: BarChart3 },
  { key: 'THEME_GALLERY', label: 'گالری پوسته‌ها و تم', icon: Palette },
  { key: 'SMS_SETTINGS', label: 'تنظیمات پیامک و احراز هویت', icon: MessageSquare },
  { key: 'RECRUITMENT_SETTINGS', label: 'تنظیمات استخدام', icon: Settings },
];

const ADMIN_AUTH_STORAGE_KEY = 'dasteva_admin_authenticated';

function checkIsAdminPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
  return path.endsWith('/admin') || path === '/admin' || hash === '/admin' || hash === 'admin';
}

export default function App() {
  const initialThemeState = loadSavedThemeFromStorage();

  const [portalMode, setPortalMode] = useState<'ADMIN' | 'APPLICANT'>(() =>
    checkIsAdminPath() ? 'ADMIN' : 'APPLICANT'
  );
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Admin Login & 2FA Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [admin2faChallengeId, setAdmin2faChallengeId] = useState('');
  const [admin2faMaskedMobile, setAdmin2faMaskedMobile] = useState('');
  const [admin2faCode, setAdmin2faCode] = useState('');
  const [admin2faResendSeconds, setAdmin2faResendSeconds] = useState(0);
  const [admin2faExpirySeconds, setAdmin2faExpirySeconds] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<AdminMenuKey>('DASHBOARD');

  // Centralized Theme Preset State
  const [activeThemeId, setActiveThemeId] = useState<ThemePresetId>(initialThemeState.themeId);
  const [previewThemeId, setPreviewThemeId] = useState<ThemePresetId | null>(null);
  const [orgDefaultThemeId, setOrgDefaultThemeId] = useState<string>(initialThemeState.themeId);
  const [customTokens, setCustomTokens] = useState<Partial<ThemeTokens>>(initialThemeState.customTokens);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  // Dashboard & Applicants State
  const [dashboardStats, setDashboardStats] = useState<DashboardData | null>(null);
  const [applicants, setApplicants] = useState<ApplicantSummaryRow[]>([]);
  const [totalApplicants, setTotalApplicants] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeDossierId, setActiveDossierId] = useState<number | null>(null);
  const [scheduleApplicantId, setScheduleApplicantId] = useState<number | null>(null);

  // Filters State for Applicants Table
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    gender: 'ALL',
    minAge: '',
    maxAge: '',
    maritalStatus: 'ALL',
    degreeLevel: 'ALL',
    city: '',
    hasWorkExperience: 'ALL',
    militaryStatus: 'ALL',
    statusCode: 'ALL',
    ageQualification: 'ALL',
    inPersonDocsStatus: 'ALL',
    sortBy: 'application_id',
    sortDir: 'desc',
    page: '1',
  });

  // Print / PDF Modal State
  const [printModal, setPrintModal] = useState<{
    isOpen: boolean;
    mode: PrintMode;
    title: string;
    singleDossier?: ApplicantFullDossier | null;
    batchDossiers?: ApplicantFullDossier[];
    applicantsList?: ApplicantSummaryRow[];
    interviewsList?: InterviewRecord[];
  }>({
    isOpen: false,
    mode: 'SINGLE_DOSSIER',
    title: '',
  });

  // Sync URL navigation (/ vs /admin)
  useEffect(() => {
    const syncRoute = () => {
      setPortalMode(checkIsAdminPath() ? 'ADMIN' : 'APPLICANT');
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const navigateToApplicantPortal = () => {
    window.history.pushState({}, '', '/');
    setPortalMode('APPLICANT');
  };

  useEffect(() => {
    if (!admin2faChallengeId) return;
    const timer = window.setInterval(() => {
      setAdmin2faResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setAdmin2faExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [admin2faChallengeId]);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.requires_2fa && data.challenge_id) {
        setAdmin2faChallengeId(data.challenge_id);
        setAdmin2faMaskedMobile(data.masked_mobile || '');
        setAdmin2faResendSeconds(Number(data.resend_after || 60));
        setAdmin2faExpirySeconds(Number(data.expires_in || 120));
        setAdmin2faCode('');
      } else if (res.ok && data.authenticated) {
        try {
          sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
        } catch {
          // ignore storage error
        }
        setIsAdminAuthenticated(true);
        setLoginPassword('');
      } else {
        setLoginError(data.error || 'نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch {
      setLoginError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: admin2faChallengeId,
          code: toEnglishDigits(admin2faCode),
        }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        try {
          sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
        } catch {
          // ignore storage error
        }
        setIsAdminAuthenticated(true);
        setLoginPassword('');
        setAdmin2faChallengeId('');
        setAdmin2faCode('');
      } else {
        setLoginError(data.error || 'کد تایید دومرحله‌ای صحیح نیست.');
      }
    } catch {
      setLoginError('خطا در ارتباط با سرور برای بررسی کد تایید.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminResend2fa = async () => {
    if (admin2faResendSeconds > 0) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth/resend-2fa', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.challenge_id) {
        setAdmin2faChallengeId(data.challenge_id);
        setAdmin2faMaskedMobile(data.masked_mobile || admin2faMaskedMobile);
        setAdmin2faResendSeconds(Number(data.resend_after || 60));
        setAdmin2faExpirySeconds(Number(data.expires_in || 120));
        setAdmin2faCode('');
      } else {
        setLoginError(data.error || 'ارسال مجدد کد تایید ناموفق بود.');
      }
    } catch {
      setLoginError('خطا در ارسال مجدد کد تایید.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    try {
      sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    } catch {
      // ignore storage error
    }
    setIsAdminAuthenticated(false);
    setLoginUsername('');
    setLoginPassword('');
    setAdmin2faChallengeId('');
    setAdmin2faCode('');
  };

  // Apply active or preview theme tokens immediately to DOM
  useEffect(() => {
    const effectiveTheme = previewThemeId || activeThemeId;
    applyThemeTokensToDocument(effectiveTheme, customTokens);
  }, [activeThemeId, previewThemeId, customTokens]);

  // Sync theme preferences from database on initial mount
  useEffect(() => {
    fetch('/api/admin/theme')
      .then((r) => r.json())
      .then((data) => {
        if (data.default_theme) {
          setOrgDefaultThemeId(data.default_theme);
        }
        if (data.custom_theme && Object.keys(data.custom_theme).length > 0) {
          setCustomTokens(data.custom_theme);
        }
        const hasLocal = Boolean(
          localStorage.getItem('omid_theme_preset') || localStorage.getItem('dasteva_active_theme')
        );
        if (!hasLocal && data.preferred_theme) {
          setActiveThemeId(data.preferred_theme as ThemePresetId);
          saveThemeToStorage(data.preferred_theme as ThemePresetId, data.custom_theme);
        }
      })
      .catch(() => {});
  }, []);

  const handleApplyTheme = async (
    themeId: ThemePresetId,
    options?: { setAsOrgDefault?: boolean; customTokens?: Partial<ThemeTokens> }
  ) => {
    const updatedCustom = options?.customTokens || customTokens;
    setPreviewThemeId(null);
    setActiveThemeId(themeId);
    if (options?.customTokens) {
      setCustomTokens(options.customTokens);
    }
    if (options?.setAsOrgDefault) {
      setOrgDefaultThemeId(themeId);
    }
    saveThemeToStorage(themeId, updatedCustom);
    applyThemeTokensToDocument(themeId, updatedCustom);

    try {
      await fetch('/api/v1/auth/theme/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_theme: themeId }),
      });
      if (options?.setAsOrgDefault || options?.customTokens) {
        await fetch('/api/v1/settings/default-theme/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            default_theme: options?.setAsOrgDefault ? themeId : orgDefaultThemeId,
            custom_theme: options?.customTokens,
          }),
        });
      }
      await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme_id: themeId,
          set_as_org_default: Boolean(options?.setAsOrgDefault),
          custom_theme: options?.customTokens ? options.customTokens : undefined,
        }),
      });
    } catch {
      // ignore transient network error
    }
  };

  const handleStartPreview = (themeId: ThemePresetId, previewCustom?: Partial<ThemeTokens>) => {
    if (previewCustom) {
      setCustomTokens(previewCustom);
    }
    setPreviewThemeId(themeId);
    applyThemeTokensToDocument(themeId, previewCustom || customTokens);
  };

  const handleCancelPreview = () => {
    setPreviewThemeId(null);
    applyThemeTokensToDocument(activeThemeId, customTokens);
  };

  const loadDashboardAndApplicants = useCallback(async () => {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'ALL') queryParams.set(k, v);
    });

    const [statsRes, listRes] = await Promise.all([
      fetch('/api/admin/dashboard-stats'),
      fetch(`/api/admin/applicants?${queryParams.toString()}`),
    ]);

    const statsData = await statsRes.json();
    const listData = await listRes.json();

    if (statsData && statsData.cards) setDashboardStats(statsData);
    if (listData && Array.isArray(listData.items)) {
      setApplicants(listData.items);
      setTotalApplicants(listData.total || listData.items.length);
    }
  }, [filters]);

  useEffect(() => {
    if (portalMode === 'ADMIN' && isAdminAuthenticated) {
      loadDashboardAndApplicants();
    }
  }, [portalMode, isAdminAuthenticated, loadDashboardAndApplicants]);

  const handleSelectMenu = (item: (typeof ADMIN_MENU_ITEMS)[number]) => {
    setActiveMenu(item.key);
    setSidebarOpen(false);
    if (item.presetStatus !== undefined) {
      setFilters((prev) => ({ ...prev, statusCode: item.presetStatus || 'ALL', page: '1' }));
    }
  };

  const handleBatchPrintSelected = async () => {
    if (selectedIds.length === 0) return;
    const res = await fetch('/api/admin/applicants/batch-dossiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_ids: selectedIds }),
    });
    const data = await res.json();
    if (data.dossiers) {
      setPrintModal({
        isOpen: true,
        mode: 'BATCH_DOSSIERS',
        title: `چاپ گروهی پرونده‌های استخدامی (${toPersianDigits(data.dossiers.length)} پرونده)`,
        batchDossiers: data.dossiers,
      });
    }
  };

  // 1. Public Applicant Portal at root path (/)
  if (portalMode === 'APPLICANT') {
    return <ApplicantPortal />;
  }

  // 2. Admin Authentication Screen at /admin when not yet logged in
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {admin2faChallengeId
                ? 'تایید هویت دومرحله‌ای مدیر سامانه'
                : 'ورود به پنل مدیریت استخدام شرکت دستوا'}
            </h1>
            <p className="text-xs text-slate-500">
              {admin2faChallengeId
                ? `کد تایید ۶ رقمی به شماره موبایل ${toPersianDigits(admin2faMaskedMobile)} پیامک شد.`
                : 'لطفاً جهت دسترسی به سامانه مدیریت جذب و پرونده‌های متقاضیان، نام کاربری و رمز عبور مدیر سامانه را وارد نمایید.'}
            </p>
          </div>

          {!admin2faChallengeId ? (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام کاربری (Username)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-left font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز عبور (Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-3.5 pr-10 py-2.5 text-sm text-left font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-extrabold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoggingIn ? 'در حال بررسی اطلاعات...' : 'ورود به پنل مدیریت'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminVerify2fa} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    کد تایید پیامکی ۶ رقمی
                  </label>
                  <span className="text-xs text-slate-500 tabular-nums">
                    اعتبار: {toPersianDigits(Math.floor(admin2faExpirySeconds / 60))}:
                    {toPersianDigits(String(admin2faExpirySeconds % 60).padStart(2, '0'))}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={6}
                  autoFocus
                  value={admin2faCode}
                  onChange={(e) => setAdmin2faCode(e.target.value)}
                  placeholder="• • • • • •"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-center text-lg font-mono tracking-[0.5em] tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || admin2faCode.trim().length < 6}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-extrabold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoggingIn ? 'در حال بررسی کد...' : 'تایید کد و ورود به داشبورد'}</span>
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleAdminResend2fa}
                  disabled={admin2faResendSeconds > 0 || isLoggingIn}
                  className="font-bold text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer tabular-nums"
                >
                  {admin2faResendSeconds > 0
                    ? `ارسال مجدد کد (${toPersianDigits(admin2faResendSeconds)} ثانیه)`
                    : 'ارسال مجدد کد تایید'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdmin2faChallengeId('');
                    setAdmin2faCode('');
                    setLoginError('');
                  }}
                  className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  بازگشت به ورود
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={navigateToApplicantPortal}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
            >
              بازگشت به صفحه اصلی متقاضیان استخدام
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeMenuObj = ADMIN_MENU_ITEMS.find((m) => m.key === activeMenu) || ADMIN_MENU_ITEMS[0];
  const effectivePreset = getPresetById(previewThemeId || activeThemeId, customTokens);

  const isApplicantsTableView = [
    'APPLICANTS_ALL',
    'APPLICANTS_NEW',
    'DOSSIERS_VIEW',
    'RESUME_REVIEW',
    'EVALUATIONS',
    'APPROVED_APPLICANTS',
    'HIRED_APPLICANTS',
  ].includes(activeMenu);

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* RTL Dynamic Theme Sidebar */}
      <aside
        className={`theme-sidebar fixed inset-y-0 right-0 z-30 w-64 flex flex-col justify-between border-l transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          {/* Sidebar Brand Header */}
          <div className="theme-sidebar-border flex items-center justify-between px-5 py-5 border-b">
            <div>
              <span
                style={{ color: effectivePreset.tokens.sidebarText }}
                className="text-base font-extrabold tracking-tight block"
              >
                شرکت دستوا
              </span>
              <span
                style={{ color: effectivePreset.tokens.sidebarMuted }}
                className="text-[11px]"
              >
                سامانه جامع مدیریت استخدام
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              style={{ color: effectivePreset.tokens.sidebarText }}
              className="lg:hidden opacity-75 hover:opacity-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 max-h-[calc(100vh-190px)] overflow-y-auto">
            {ADMIN_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectMenu(item)}
                  style={
                    isActive
                      ? {
                          backgroundColor: effectivePreset.tokens.sidebarActiveBg,
                          color: effectivePreset.tokens.sidebarActiveText,
                        }
                      : {
                          color: effectivePreset.tokens.sidebarText,
                        }
                  }
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive ? 'theme-sidebar-item-active shadow-xs' : 'hover:opacity-85'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Switch to Public Applicant Portal & Logout Buttons */}
        <div className="theme-sidebar-border p-4 border-t space-y-2">
          <button
            type="button"
            onClick={navigateToApplicantPortal}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>مشاهده پنل متقاضی استخدام</span>
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج از پنل مدیریت</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Live Preview Bar (if previewing a theme) */}
        {previewThemeId && (
          <div className="bg-blue-600 text-white px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <Eye className="w-4 h-4" />
              <span>
                پیش‌نمایش زنده پوسته: «{effectivePreset.persianName} ({effectivePreset.englishName})»
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyTheme(previewThemeId)}
                className="flex items-center gap-1 rounded bg-white text-slate-900 px-3 py-1 font-extrabold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>اعمال دائمی</span>
              </button>
              <button
                type="button"
                onClick={handleCancelPreview}
                className="flex items-center gap-1 rounded border border-white/50 px-3 py-1 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>لغو پیش‌نمایش</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="flex items-center justify-between gap-6 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 relative">
          {/* Zone 1: Breadcrumb / Active View Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border border-slate-300 dark:border-slate-700 p-2 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
              پنل مدیریت استخدام دستوا / {activeMenuObj.label}
            </span>
          </div>

          {/* Zone 2: Single Administrator Badge */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-slate-500 whitespace-nowrap">کاربر فعال:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">
              مدیر سامانه (admin)
            </span>
          </div>

          {/* Zone 3: Topbar "پوسته‌ها" Modal Trigger + Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <span
                style={{ backgroundColor: effectivePreset.tokens.primary }}
                className="w-3 h-3 rounded-full inline-block shrink-0"
              />
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              <span>پوسته‌ها ({effectivePreset.persianName})</span>
            </button>

            <button
              type="button"
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {activeMenu === 'DASHBOARD' && (
            <DashboardAnalyticsView
              stats={dashboardStats}
              onNavigateStatusFilter={(statusCode) => {
                setFilters((prev) => ({ ...prev, statusCode, page: '1' }));
                setActiveMenu('APPLICANTS_ALL');
              }}
            />
          )}

          {(activeMenu === 'ANALYTICS_DASHBOARD' || activeMenu === 'REPORTS_STATS') && (
            <AnalyticsDashboardView
              stats={dashboardStats}
              onNavigateStatusFilter={(statusCode) => {
                setFilters((prev) => ({ ...prev, statusCode, page: '1' }));
                setActiveMenu('APPLICANTS_ALL');
              }}
            />
          )}

          {isApplicantsTableView && (
            <ApplicantsTableView
              items={applicants}
              total={totalApplicants}
              filters={filters}
              setFilters={setFilters}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onOpenDossier={(appId) => setActiveDossierId(appId)}
              onCompareSelected={() => setActiveMenu('COMPARISON')}
              onBatchPrintSelected={handleBatchPrintSelected}
              onBulkStatusUpdated={loadDashboardAndApplicants}
              onPrintTableReport={() =>
                setPrintModal({
                  isOpen: true,
                  mode: 'APPLICANTS_LIST_REPORT',
                  title: 'گزارش چاپی و PDF فهرست متقاضیان استخدام شرکت دستوا',
                  applicantsList: applicants,
                })
              }
            />
          )}

          {activeMenu === 'WORKFLOW_PIPELINE' && (
            <WorkflowPipelineView
              items={applicants}
              onOpenDossier={(appId) => setActiveDossierId(appId)}
            />
          )}

          {activeMenu === 'COMPARISON' && (
            <ComparisonModuleView
              allApplicants={applicants}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onOpenDossier={(appId) => setActiveDossierId(appId)}
              onPrintComparison={(dossiers) =>
                setPrintModal({
                  isOpen: true,
                  mode: 'COMPARISON_REPORT',
                  title: 'گزارش مقایسه تحلیلی متقاضیان استخدام شرکت دستوا',
                  batchDossiers: dossiers,
                })
              }
            />
          )}

          {(activeMenu === 'INTERVIEWS_MANAGE' || activeMenu === 'RECRUITMENT_CALENDAR') && (
            <InterviewsCalendarModuleView
              allApplicants={applicants}
              preselectedApplicantId={scheduleApplicantId}
              onOpenDossier={(appId) => setActiveDossierId(appId)}
              onPrintInterviews={(ivList) =>
                setPrintModal({
                  isOpen: true,
                  mode: 'INTERVIEWS_LIST_REPORT',
                  title: 'گزارش برنامه زمان‌بندی و فهرست مصاحبه‌های استخدامی',
                  interviewsList: ivList,
                })
              }
            />
          )}

          {activeMenu === 'THEME_GALLERY' && (
            <ThemeGalleryView
              activeThemeId={activeThemeId}
              previewThemeId={previewThemeId}
              orgDefaultThemeId={orgDefaultThemeId}
              customTokens={customTokens}
              onApplyTheme={handleApplyTheme}
              onStartPreview={handleStartPreview}
              onCancelPreview={handleCancelPreview}
            />
          )}

          {activeMenu === 'SMS_SETTINGS' && <SmsSettingsView />}

          {activeMenu === 'RECRUITMENT_SETTINGS' && (
            <SettingsAndUsersView
              onSettingsUpdated={loadDashboardAndApplicants}
              onOpenThemeGallery={() => setActiveMenu('THEME_GALLERY')}
              activeThemeId={activeThemeId}
              previewThemeId={previewThemeId}
              orgDefaultThemeId={orgDefaultThemeId}
              customTokens={customTokens}
              onApplyTheme={handleApplyTheme}
              onStartPreview={handleStartPreview}
              onCancelPreview={handleCancelPreview}
            />
          )}
        </main>
      </div>

      {/* Topbar Theme Gallery Modal (Fast Access Path #1) */}
      <ThemeGalleryModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        activeThemeId={activeThemeId}
        previewThemeId={previewThemeId}
        orgDefaultThemeId={orgDefaultThemeId}
        customTokens={customTokens}
        onApplyTheme={handleApplyTheme}
        onStartPreview={handleStartPreview}
        onCancelPreview={handleCancelPreview}
      />

      {/* Unified Applicant Dossier Modal */}
      <DossierDrawerModal
        applicationId={activeDossierId}
        onClose={() => setActiveDossierId(null)}
        onUpdated={loadDashboardAndApplicants}
        onPrintSingle={(dossier) =>
          setPrintModal({
            isOpen: true,
            mode: 'SINGLE_DOSSIER',
            title: `چاپ پرونده انفرادی: ${dossier.full_name}`,
            singleDossier: dossier,
          })
        }
        onScheduleInterviewForApplicant={(appId) => {
          setActiveDossierId(null);
          setScheduleApplicantId(appId);
          setActiveMenu('RECRUITMENT_CALENDAR');
        }}
      />

      {/* Official RTL Persian Print & PDF Engine Modal */}
      <PrintReportModal
        isOpen={printModal.isOpen}
        onClose={() => setPrintModal((prev) => ({ ...prev, isOpen: false }))}
        mode={printModal.mode}
        title={printModal.title}
        singleDossier={printModal.singleDossier}
        batchDossiers={printModal.batchDossiers}
        applicantsList={printModal.applicantsList}
        interviewsList={printModal.interviewsList}
        canViewEvaluations={true}
      />
    </div>
  );
}

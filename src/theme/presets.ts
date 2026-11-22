export type ThemePresetId =
  | 'azure-professional'
  | 'midnight-executive'
  | 'ocean-breeze'
  | 'emerald-forest'
  | 'lavender-studio'
  | 'warm-sand'
  | 'rose-quartz'
  | 'graphite-minimal'
  | 'obsidian-gold'
  | 'custom-org';

export interface ThemeTokens {
  bgCanvas: string;
  bgSurface: string;
  bgSubtle: string;
  bgHover: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  primaryText: string;
  chart1: string;
  chart2: string;
  chart3: string;
  shadow: string;
  isDark: boolean;
}

export interface ThemePreset {
  id: ThemePresetId;
  order: number;
  englishName: string;
  persianName: string;
  brightnessLabel: string;
  shortTagline: string;
  psychologyDescription: string;
  category: 'LIGHT_COLORFUL' | 'DARK_EXECUTIVE';
  tokens: ThemeTokens;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'azure-professional',
    order: 1,
    englishName: 'Azure Professional',
    persianName: 'آبی سازمانی',
    brightnessLabel: 'روشن',
    shortTagline: 'اعتماد، ثبات، شفافیت و حرفه‌ای‌بودن',
    psychologyDescription:
      'پالت رسمی و شفاف سازمانی با پس‌زمینه آبی-نقره‌ای روشن (#F4F7FE)، سایدبار و کارت‌های سفید خالص (#FFFFFF) و رنگ اصلی آبی سازمانی (#2563EB)؛ ایجادکننده حس اعتماد، ثبات و نظم حرفه‌ای.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#F4F7FE',
      bgSurface: '#FFFFFF',
      bgSubtle: '#F8FAFC',
      bgHover: '#EFF6FF',
      sidebarBg: '#FFFFFF',
      sidebarBorder: '#E2E8F0',
      sidebarText: '#0F172A',
      sidebarMuted: '#64748B',
      sidebarActiveBg: '#2563EB',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      border: '#E2E8F0',
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primarySoft: '#DBEAFE',
      primaryText: '#FFFFFF',
      chart1: '#2563EB',
      chart2: '#4F46E5',
      chart3: '#059669',
      shadow: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
      isDark: false,
    },
  },
  {
    id: 'midnight-executive',
    order: 2,
    englishName: 'Midnight Executive',
    persianName: 'سرمه‌ای مدیریتی',
    brightnessLabel: 'تیره',
    shortTagline: 'اقتدار، تمرکز بالا، امنیت و مدیریت کلان',
    psychologyDescription:
      'پوسته تیره مدیریتی با پس‌زمینه سرمه‌ای شبانه (#0B1120)، سایدبار (#111C35)، کارت‌های لایه‌بندی‌شده سرمه‌ای (#16223D) و هایلایت‌های آبی درخشان (#3B82F6)؛ مناسب مدیریت کلان و تمرکز بالا.',
    category: 'DARK_EXECUTIVE',
    tokens: {
      bgCanvas: '#0B1120',
      bgSurface: '#16223D',
      bgSubtle: '#111C35',
      bgHover: '#1E293B',
      sidebarBg: '#111C35',
      sidebarBorder: '#1E2D4D',
      sidebarText: '#E2E8F0',
      sidebarMuted: '#94A3B8',
      sidebarActiveBg: '#3B82F6',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: '#1E2D4D',
      primary: '#3B82F6',
      primaryHover: '#2563EB',
      primarySoft: '#1E3A8A',
      primaryText: '#FFFFFF',
      chart1: '#3B82F6',
      chart2: '#38BDF8',
      chart3: '#34D399',
      shadow: '0 4px 12px -2px rgba(2, 6, 23, 0.5)',
      isDark: true,
    },
  },
  {
    id: 'ocean-breeze',
    order: 3,
    englishName: 'Ocean Breeze',
    persianName: 'نسیم اقیانوسی',
    brightnessLabel: 'روشن رنگی',
    shortTagline: 'آرامش، تعادل، طراوت و شفافیت',
    psychologyDescription:
      'ترکیب باطراوت فیروزه‌ای روشن (#ECFEFF)، سایدبار آبی اقیانوسی عمیق (#0E3A47) و رنگ تعاملی فیروزه‌ای دریایی (#0891B2) که حس آرامش، تعادل و شفافیت ایجاد می‌کند.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#ECFEFF',
      bgSurface: '#FFFFFF',
      bgSubtle: '#F0FDFA',
      bgHover: '#CCFBF1',
      sidebarBg: '#0E3A47',
      sidebarBorder: '#155061',
      sidebarText: '#ECFEFF',
      sidebarMuted: '#88C8D6',
      sidebarActiveBg: '#0891B2',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#083344',
      textSecondary: '#155E75',
      textMuted: '#0E7490',
      border: '#BAE6FD',
      primary: '#0891B2',
      primaryHover: '#0E7490',
      primarySoft: '#CFFAFE',
      primaryText: '#FFFFFF',
      chart1: '#0891B2',
      chart2: '#0D9488',
      chart3: '#0284C7',
      shadow: '0 1px 3px 0 rgba(8, 51, 68, 0.07)',
      isDark: false,
    },
  },
  {
    id: 'emerald-forest',
    order: 4,
    englishName: 'Emerald Forest',
    persianName: 'جنگل زمردی',
    brightnessLabel: 'روشن رنگی',
    shortTagline: 'رشد مالی، پایداری، طبیعت و اطمینان',
    psychologyDescription:
      'الهام‌گرفته از سبز زمردی (#059669) با سایدبار جنگلی تیره (#06392A) و پس‌زمینه سبز نعنایی ملایم (#F0FDF4)؛ نماد رشد منابع انسانی، پایداری و تصمیم‌گیری مطمئن.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#F0FDF4',
      bgSurface: '#FFFFFF',
      bgSubtle: '#F4FBF7',
      bgHover: '#DCFCE7',
      sidebarBg: '#06392A',
      sidebarBorder: '#0E4F3C',
      sidebarText: '#ECFDF5',
      sidebarMuted: '#6EE7B7',
      sidebarActiveBg: '#059669',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#062C1E',
      textSecondary: '#14532D',
      textMuted: '#3F6251',
      border: '#BBF7D0',
      primary: '#059669',
      primaryHover: '#047857',
      primarySoft: '#D1FAE5',
      primaryText: '#FFFFFF',
      chart1: '#059669',
      chart2: '#0D9488',
      chart3: '#16A34A',
      shadow: '0 1px 3px 0 rgba(6, 44, 30, 0.07)',
      isDark: false,
    },
  },
  {
    id: 'lavender-studio',
    order: 5,
    englishName: 'Lavender Studio',
    persianName: 'استودیو اسطوخودوس',
    brightnessLabel: 'روشن رنگی',
    shortTagline: 'خلاقیت، نوآوری، ظرافت و مدرنیته',
    psychologyDescription:
      'فضایی مدرن و ظریف با تناژ اسطوخودوس (#F6F3FF)، رنگ اصلی بنفش خلاقانه (#7C3AED) و سایدبار بنفش شبانه (#241445)؛ مناسب تیم‌های خلاق، نوآور و مدرن.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#F6F3FF',
      bgSurface: '#FFFFFF',
      bgSubtle: '#FAF8FF',
      bgHover: '#EDE9FE',
      sidebarBg: '#241445',
      sidebarBorder: '#352063',
      sidebarText: '#F3E8FF',
      sidebarMuted: '#C4B5FD',
      sidebarActiveBg: '#7C3AED',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#1E1B4B',
      textSecondary: '#3B0764',
      textMuted: '#6D28D9',
      border: '#DDD6FE',
      primary: '#7C3AED',
      primaryHover: '#6D28D9',
      primarySoft: '#EDE9FE',
      primaryText: '#FFFFFF',
      chart1: '#7C3AED',
      chart2: '#6366F1',
      chart3: '#EC4899',
      shadow: '0 1px 3px 0 rgba(30, 27, 75, 0.07)',
      isDark: false,
    },
  },
  {
    id: 'warm-sand',
    order: 6,
    englishName: 'Warm Sand',
    persianName: 'شن‌های گرم و اصیل',
    brightnessLabel: 'روشن گرم',
    shortTagline: 'صمیمیت، گرما، اصالت و آرامش چشم',
    psychologyDescription:
      'ترکیب دلنشین کرم شنی (#FAF6F0)، کارت‌های کاغذی گرم (#FFFDF9)، سایدبار قهوه‌ای اسپرسو (#2C1E14) و کهربایی اصیل (#B45309) برای خوانایی نرم و بدون خستگی چشم.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#FAF6F0',
      bgSurface: '#FFFDF9',
      bgSubtle: '#F5EFE6',
      bgHover: '#EFE5D5',
      sidebarBg: '#2C1E14',
      sidebarBorder: '#422F21',
      sidebarText: '#F5EBE1',
      sidebarMuted: '#C2A88E',
      sidebarActiveBg: '#B45309',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#291D15',
      textSecondary: '#573D2B',
      textMuted: '#85644B',
      border: '#E6D7C3',
      primary: '#B45309',
      primaryHover: '#92400E',
      primarySoft: '#FEF3C7',
      primaryText: '#FFFFFF',
      chart1: '#B45309',
      chart2: '#D97706',
      chart3: '#15803D',
      shadow: '0 1px 3px 0 rgba(44, 30, 20, 0.07)',
      isDark: false,
    },
  },
  {
    id: 'rose-quartz',
    order: 7,
    englishName: 'Rose Quartz',
    persianName: 'کوارتز رز',
    brightnessLabel: 'روشن رنگی',
    shortTagline: 'لطافت، تعامل انسانی، زیبایی و تمایز',
    psychologyDescription:
      'هماهنگی چشم‌نواز کوارتز رز (#FFF5F7)، یاقوتی (#E11D48) و سایدبار زرشکی تیره (#3B1022)؛ القاگر حس همدلی، ارتباط انسانی صمیمی و تمایز بصری.',
    category: 'LIGHT_COLORFUL',
    tokens: {
      bgCanvas: '#FFF5F7',
      bgSurface: '#FFFFFF',
      bgSubtle: '#FFF8FA',
      bgHover: '#FFE4E9',
      sidebarBg: '#3B1022',
      sidebarBorder: '#541932',
      sidebarText: '#FCE7F3',
      sidebarMuted: '#F472B6',
      sidebarActiveBg: '#E11D48',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#3B0A1E',
      textSecondary: '#681838',
      textMuted: '#9F1239',
      border: '#FBCFE8',
      primary: '#E11D48',
      primaryHover: '#BE123C',
      primarySoft: '#FFE4E6',
      primaryText: '#FFFFFF',
      chart1: '#E11D48',
      chart2: '#9333EA',
      chart3: '#0D9488',
      shadow: '0 1px 3px 0 rgba(59, 16, 34, 0.07)',
      isDark: false,
    },
  },
  {
    id: 'graphite-minimal',
    order: 8,
    englishName: 'Graphite Minimal',
    persianName: 'گرافیت مینیمال',
    brightnessLabel: 'تیره ذغالی',
    shortTagline: 'سادگی محض، تمرکز، نظم معماری و کنتراست',
    psychologyDescription:
      'طراحی مونوکروم و فوق‌مینیمال با طیف ذغالی (#121316)، سایدبار (#18191E)، سطح کارت (#1E2026) و نیلی مدرن (#6366F1)؛ ایده‌آل برای تحلیل داده‌ها و جداول سنگین.',
    category: 'DARK_EXECUTIVE',
    tokens: {
      bgCanvas: '#121316',
      bgSurface: '#1E2026',
      bgSubtle: '#18191E',
      bgHover: '#292D36',
      sidebarBg: '#18191E',
      sidebarBorder: '#272932',
      sidebarText: '#E4E4E7',
      sidebarMuted: '#A1A1AA',
      sidebarActiveBg: '#6366F1',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#F4F4F5',
      textSecondary: '#D4D4D8',
      textMuted: '#A1A1AA',
      border: '#2D313B',
      primary: '#6366F1',
      primaryHover: '#4F46E5',
      primarySoft: '#27272A',
      primaryText: '#FFFFFF',
      chart1: '#6366F1',
      chart2: '#A1A1AA',
      chart3: '#34D399',
      shadow: '0 4px 12px -2px rgba(0, 0, 0, 0.55)',
      isDark: true,
    },
  },
  {
    id: 'obsidian-gold',
    order: 9,
    englishName: 'Obsidian Gold',
    persianName: 'ابسیدین و طلایی لوکس',
    brightnessLabel: 'تیره لوکس',
    shortTagline: 'پرستیژ مالی، بانکداری اختصاصی و شکوه',
    psychologyDescription:
      'پوسته لوکس و باوقار با پس‌زمینه سنگ ابسیدین (#0C0A09)، سایدبار (#171412)، کارت‌های (#1C1917) و درخشش طلایی (#D97706)؛ القاگر پرستیژ سازمانی و شکوه مدیریتی.',
    category: 'DARK_EXECUTIVE',
    tokens: {
      bgCanvas: '#0C0A09',
      bgSurface: '#1C1917',
      bgSubtle: '#171412',
      bgHover: '#292524',
      sidebarBg: '#171412',
      sidebarBorder: '#292524',
      sidebarText: '#F5F5F4',
      sidebarMuted: '#A8A29E',
      sidebarActiveBg: '#D97706',
      sidebarActiveText: '#FFFFFF',
      textPrimary: '#FAFAF9',
      textSecondary: '#E7E5E4',
      textMuted: '#A8A29E',
      border: '#292524',
      primary: '#D97706',
      primaryHover: '#B45309',
      primarySoft: '#451A03',
      primaryText: '#FFFFFF',
      chart1: '#D97706',
      chart2: '#F59E0B',
      chart3: '#10B981',
      shadow: '0 4px 14px -2px rgba(0, 0, 0, 0.65)',
      isDark: true,
    },
  },
];

export const DEFAULT_CUSTOM_ORG_TOKENS: ThemeTokens = {
  bgCanvas: '#F2F6FA',
  bgSurface: '#FFFFFF',
  bgSubtle: '#F8FAFC',
  bgHover: '#E2E8F0',
  sidebarBg: '#162436',
  sidebarBorder: '#243852',
  sidebarText: '#E2E8F0',
  sidebarMuted: '#94A3B8',
  sidebarActiveBg: '#0284C7',
  sidebarActiveText: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  border: '#CBD5E1',
  primary: '#0284C7',
  primaryHover: '#0369A1',
  primarySoft: '#E0F2FE',
  primaryText: '#FFFFFF',
  chart1: '#0284C7',
  chart2: '#0D9488',
  chart3: '#4F46E5',
  shadow: '0 1px 3px 0 rgba(15, 23, 42, 0.06)',
  isDark: false,
};

export const LOCAL_STORAGE_THEME_KEY = 'omid_theme_preset';
export const LEGACY_STORAGE_THEME_KEY = 'dasteva_active_theme';
export const LOCAL_STORAGE_CUSTOM_TOKENS_KEY = 'dasteva_custom_theme_tokens';

export function getPresetById(id: string, customTokens?: Partial<ThemeTokens>): ThemePreset {
  if (id === 'custom-org') {
    const merged: ThemeTokens = {
      ...DEFAULT_CUSTOM_ORG_TOKENS,
      ...(customTokens || {}),
    };
    return {
      id: 'custom-org',
      order: 10,
      englishName: 'Custom Organization',
      persianName: 'پوسته اختصاصی سازمان',
      brightnessLabel: 'قابل تنظیم',
      shortTagline: 'قابل تعریف توسط مدیر سازمان با رنگ دلخواه',
      psychologyDescription:
        'انتخابگر رنگ زنده برای رنگ اصلی، سایدبار، پس‌زمینه و کارت‌ها؛ قابل تعریف توسط مدیر سازمان متناسب با هویت بصری اختصاصی.',
      category: merged.isDark ? 'DARK_EXECUTIVE' : 'LIGHT_COLORFUL',
      tokens: merged,
    };
  }
  return THEME_PRESETS.find((t) => t.id === id) || THEME_PRESETS[0];
}

export function getAllPresetsWithCustom(customTokens?: Partial<ThemeTokens>): ThemePreset[] {
  return [...THEME_PRESETS, getPresetById('custom-org', customTokens)];
}

export function applyThemeTokensToDocument(
  themeId: ThemePresetId | string,
  customTokens?: Partial<ThemeTokens>
): ThemePreset {
  const preset = getPresetById(themeId, customTokens);
  const { tokens } = preset;
  const root = document.documentElement;

  root.setAttribute('data-theme', preset.id);
  if (tokens.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 1. Set --theme-* tokens
  root.style.setProperty('--theme-bg-canvas', tokens.bgCanvas);
  root.style.setProperty('--theme-bg-surface', tokens.bgSurface);
  root.style.setProperty('--theme-bg-subtle', tokens.bgSubtle);
  root.style.setProperty('--theme-bg-hover', tokens.bgHover);
  root.style.setProperty('--theme-sidebar-bg', tokens.sidebarBg);
  root.style.setProperty('--theme-sidebar-border', tokens.sidebarBorder);
  root.style.setProperty('--theme-sidebar-text', tokens.sidebarText);
  root.style.setProperty('--theme-sidebar-muted', tokens.sidebarMuted);
  root.style.setProperty('--theme-sidebar-active-bg', tokens.sidebarActiveBg);
  root.style.setProperty('--theme-sidebar-active-text', tokens.sidebarActiveText);
  root.style.setProperty('--theme-text-primary', tokens.textPrimary);
  root.style.setProperty('--theme-text-secondary', tokens.textSecondary);
  root.style.setProperty('--theme-text-muted', tokens.textMuted);
  root.style.setProperty('--theme-border', tokens.border);
  root.style.setProperty('--theme-primary', tokens.primary);
  root.style.setProperty('--theme-primary-hover', tokens.primaryHover);
  root.style.setProperty('--theme-primary-soft', tokens.primarySoft);
  root.style.setProperty('--theme-primary-text', tokens.primaryText);
  root.style.setProperty('--theme-chart-1', tokens.chart1);
  root.style.setProperty('--theme-chart-2', tokens.chart2);
  root.style.setProperty('--theme-chart-3', tokens.chart3);
  root.style.setProperty('--theme-shadow', tokens.shadow);

  // 2. Set --ta-* Design Tokens (Architecture Spec)
  root.style.setProperty('--ta-primary', tokens.primary);
  root.style.setProperty('--ta-primary-hover', tokens.primaryHover);
  root.style.setProperty('--ta-primary-soft', tokens.primarySoft);
  root.style.setProperty('--ta-whiten', tokens.bgCanvas);
  root.style.setProperty('--ta-card-bg', tokens.bgSurface);
  root.style.setProperty('--ta-table-head', tokens.bgSubtle);
  root.style.setProperty('--ta-stroke', tokens.border);
  root.style.setProperty('--ta-black', tokens.textPrimary);
  root.style.setProperty('--ta-body', tokens.textSecondary);
  root.style.setProperty('--ta-muted', tokens.textMuted);
  root.style.setProperty('--ta-sidebar-bg', tokens.sidebarBg);
  root.style.setProperty('--ta-sidebar-text', tokens.sidebarText);
  root.style.setProperty('--ta-sidebar-active-bg', tokens.sidebarActiveBg);
  root.style.setProperty('--ta-topbar-bg', tokens.bgSurface);
  root.style.setProperty('--ta-chart-1', tokens.chart1);
  root.style.setProperty('--ta-chart-2', tokens.chart2);
  root.style.setProperty('--ta-chart-3', tokens.chart3);
  root.style.setProperty('--ta-shadow-card', tokens.shadow);

  return preset;
}

export function loadSavedThemeFromStorage(): {
  themeId: ThemePresetId;
  customTokens: Partial<ThemeTokens>;
} {
  try {
    const savedId =
      (localStorage.getItem(LOCAL_STORAGE_THEME_KEY) as ThemePresetId) ||
      (localStorage.getItem(LEGACY_STORAGE_THEME_KEY) as ThemePresetId) ||
      'azure-professional';
    const rawCustom = localStorage.getItem(LOCAL_STORAGE_CUSTOM_TOKENS_KEY);
    const customTokens = rawCustom ? JSON.parse(rawCustom) : {};
    return { themeId: savedId, customTokens };
  } catch {
    return { themeId: 'azure-professional', customTokens: {} };
  }
}

export function saveThemeToStorage(
  themeId: ThemePresetId,
  customTokens?: Partial<ThemeTokens>
): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, themeId);
    localStorage.setItem(LEGACY_STORAGE_THEME_KEY, themeId);
    if (customTokens) {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_TOKENS_KEY, JSON.stringify(customTokens));
    }
  } catch {
    // ignore storage errors
  }
}

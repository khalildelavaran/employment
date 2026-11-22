import React, { useState } from 'react';
import {
  Palette,
  CheckCircle2,
  Eye,
  Sparkles,
  Building2,
  RotateCcw,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import {
  DEFAULT_CUSTOM_ORG_TOKENS,
  ThemePreset,
  ThemePresetId,
  ThemeTokens,
  getAllPresetsWithCustom,
  getPresetById,
} from '../theme/presets.ts';
import { toPersianDigits } from '../utils/validation.ts';

interface ThemeGalleryViewProps {
  activeThemeId: ThemePresetId;
  previewThemeId: ThemePresetId | null;
  orgDefaultThemeId: string;
  customTokens: Partial<ThemeTokens>;
  onApplyTheme: (
    themeId: ThemePresetId,
    options?: { setAsOrgDefault?: boolean; customTokens?: Partial<ThemeTokens> }
  ) => void;
  onStartPreview: (themeId: ThemePresetId, customTokens?: Partial<ThemeTokens>) => void;
  onCancelPreview: () => void;
  compactMode?: boolean;
}

export const ThemeGalleryView: React.FC<ThemeGalleryViewProps> = ({
  activeThemeId,
  previewThemeId,
  orgDefaultThemeId,
  customTokens,
  onApplyTheme,
  onStartPreview,
  onCancelPreview,
  compactMode = false,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'LIGHT_COLORFUL' | 'DARK_EXECUTIVE'>('ALL');
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const mergedCustom: ThemeTokens = {
    ...DEFAULT_CUSTOM_ORG_TOKENS,
    ...customTokens,
  };

  const [draftCustom, setDraftCustom] = useState<ThemeTokens>(mergedCustom);

  const effectiveId = previewThemeId || activeThemeId;
  const currentActivePreset = getPresetById(effectiveId, draftCustom);

  const allTenPresets = getAllPresetsWithCustom(draftCustom);
  const lightCount = allTenPresets.filter((p) => p.category === 'LIGHT_COLORFUL').length;
  const darkCount = allTenPresets.filter((p) => p.category === 'DARK_EXECUTIVE').length;

  const filteredPresets = allTenPresets.filter((p) => {
    if (categoryFilter === 'ALL') return true;
    return p.category === categoryFilter;
  });

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleDirectApply = (preset: ThemePreset, setAsOrgDefault = false) => {
    if (preset.id === 'custom-org') {
      onApplyTheme('custom-org', { setAsOrgDefault, customTokens: draftCustom });
    } else {
      onApplyTheme(preset.id, { setAsOrgDefault });
    }
    triggerToast(
      setAsOrgDefault
        ? `پوسته «${preset.persianName}» اعمال و به عنوان پوسته پیش‌فرض سازمان ذخیره شد.`
        : `پوسته «${preset.persianName}» با موفقیت روی کل سامانه اعمال گردید.`
    );
  };

  const handleSaveCustomTheme = (setAsOrgDefault = false) => {
    onApplyTheme('custom-org', {
      setAsOrgDefault,
      customTokens: draftCustom,
    });
    triggerToast('پوسته اختصاصی سازمان با موفقیت ذخیره و روی سامانه اعمال شد.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Live Preview Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: currentActivePreset.tokens.primarySoft,
                color: currentActivePreset.tokens.primary,
              }}
            >
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>گالری پوسته‌های آماده (Theme Presets Gallery — ۱۰ تم اختصاصی)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                هر تم تمام فضای داشبورد شامل پس‌زمینه اصلی، رنگ و استایل سایدبار، هدر، سطح کارت‌ها، جداول، فرم‌ها، سایه‌ها و رنگ نمودارها را بر پایه توکن‌های طراحی تغییر می‌دهد.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCustomBuilder(!showCustomBuilder)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showCustomBuilder ? 'بستن تنظیمات رنگ پوسته سازمانی' : 'شخصی‌سازی پوسته اختصاصی سازمان (تم ۱۰)'}</span>
            </button>
          </div>
        </div>

        {/* Active / Previewing Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">پوسته فعال فعلی:</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {getPresetById(activeThemeId, customTokens).persianName} ({getPresetById(activeThemeId, customTokens).englishName})
              </span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500">پوسته پیش‌فرض سازمان:</span>
              <span className="font-bold text-blue-600">
                {getPresetById(orgDefaultThemeId, customTokens).persianName}
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {[
              { id: 'ALL', label: `همه پوسته‌ها (${toPersianDigits(allTenPresets.length)})` },
              { id: 'LIGHT_COLORFUL', label: `روشن و رنگی (${toPersianDigits(lightCount)})` },
              { id: 'DARK_EXECUTIVE', label: `تیره و مدیریتی (${toPersianDigits(darkCount)})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id as typeof categoryFilter)}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Notice Banner */}
        {previewThemeId && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>
                شما در حال مشاهده «پیش‌نمایش زنده» پوسته{' '}
                <strong>{currentActivePreset.persianName} ({currentActivePreset.englishName})</strong> روی کل داشبورد هستید.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDirectApply(currentActivePreset, false)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 font-bold text-white cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تأیید و اعمال دائمی این تم</span>
              </button>
              <button
                type="button"
                onClick={onCancelPreview}
                className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>لغو پیش‌نمایش</span>
              </button>
            </div>
          </div>
        )}

        {toastMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Custom Organizational Theme Studio (Theme #10 Live Color Picker) */}
      {showCustomBuilder && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>۱۰. پوسته اختصاصی سازمان (Custom Organization — انتخابگر رنگ زنده)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                رنگ اصلی، سایدبار، پس‌زمینه و سطح کارت‌ها را با رنگ دلخواه سازمان تنظیم و ذخیره نمایید.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={draftCustom.isDark}
                onChange={(e) => {
                  const isDark = e.target.checked;
                  setDraftCustom((prev) => ({
                    ...prev,
                    isDark,
                    bgCanvas: isDark ? '#0D131F' : '#F2F6FA',
                    bgSurface: isDark ? '#151E30' : '#FFFFFF',
                    bgSubtle: isDark ? '#1D2940' : '#F8FAFC',
                    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
                    textSecondary: isDark ? '#CBD5E1' : '#334155',
                    textMuted: isDark ? '#94A3B8' : '#64748B',
                    border: isDark ? '#26344D' : '#CBD5E1',
                  }));
                }}
              />
              <span>ساختار پایه تیره (Dark Mode Base)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1.5">رنگ اصلی (Primary)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.primary}
                  onChange={(e) =>
                    setDraftCustom((p) => ({
                      ...p,
                      primary: e.target.value,
                      primaryHover: e.target.value,
                      sidebarActiveBg: e.target.value,
                      chart1: e.target.value,
                    }))
                  }
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.primary}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">رنگ سایدبار (Sidebar)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.sidebarBg}
                  onChange={(e) => setDraftCustom((p) => ({ ...p, sidebarBg: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.sidebarBg}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">پس‌زمینه (Canvas)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.bgCanvas}
                  onChange={(e) => setDraftCustom((p) => ({ ...p, bgCanvas: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.bgCanvas}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">سطح کارت (Surface)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.bgSurface}
                  onChange={(e) => setDraftCustom((p) => ({ ...p, bgSurface: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.bgSurface}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">رنگ خطوط (Stroke)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.border}
                  onChange={(e) => setDraftCustom((p) => ({ ...p, border: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.border}</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">رنگ متن اصلی</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftCustom.textPrimary}
                  onChange={(e) => setDraftCustom((p) => ({ ...p, textPrimary: e.target.value }))}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <span className="font-mono text-[11px]">{draftCustom.textPrimary}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => onStartPreview('custom-org', draftCustom)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 font-semibold cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>پیش‌نمایش زنده پوسته سفارشی</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveCustomTheme(false)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white cursor-pointer"
            >
              ذخیره و اعمال پوسته سفارشی
            </button>
            <button
              type="button"
              onClick={() => handleSaveCustomTheme(true)}
              className="rounded-lg border border-blue-600 px-3.5 py-2 font-bold text-blue-600 cursor-pointer"
            >
              ذخیره به عنوان تم پیش‌فرض سازمان
            </button>
          </div>
        </div>
      )}

      {/* 10 Preset Cards Grid */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          compactMode ? 'xl:grid-cols-3' : 'xl:grid-cols-5'
        } gap-4`}
      >
        {filteredPresets.map((preset) => {
          const isSelected = activeThemeId === preset.id && !previewThemeId;
          const isPreviewing = previewThemeId === preset.id;
          const isOrgDefault = orgDefaultThemeId === preset.id;
          const t = preset.tokens;

          return (
            <div
              key={preset.id}
              style={{
                backgroundColor: t.bgSurface,
                borderColor: isSelected || isPreviewing ? t.primary : t.border,
                color: t.textPrimary,
              }}
              className={`rounded-2xl border-2 overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                isSelected || isPreviewing ? 'ring-2 ring-offset-2' : 'hover:-translate-y-0.5'
              }`}
            >
              <div>
                {/* Realistic Mini-Dashboard Architectural Preview */}
                <div
                  style={{
                    backgroundColor: t.bgCanvas,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                  className="p-3 relative"
                >
                  {/* Status Badges Overlay */}
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <span
                      style={{
                        backgroundColor: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
                        color: t.textSecondary,
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums truncate"
                    >
                      {toPersianDigits(preset.order)}. {preset.englishName}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        style={{
                          backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)',
                          color: t.textMuted,
                        }}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      >
                        {preset.brightnessLabel}
                      </span>
                      {isOrgDefault && (
                        <span
                          style={{
                            backgroundColor: t.primarySoft,
                            color: t.primary,
                          }}
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                        >
                          پیش‌فرض
                        </span>
                      )}
                      {isSelected && (
                        <span
                          style={{
                            backgroundColor: t.primary,
                            color: '#FFFFFF',
                          }}
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                        >
                          <Check className="w-2.5 h-2.5" />
                          فعال
                        </span>
                      )}
                      {isPreviewing && (
                        <span
                          style={{
                            backgroundColor: '#F59E0B',
                            color: '#FFFFFF',
                          }}
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                        >
                          پیش‌نمایش
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mini RTL Dashboard Schematic (Sidebar + Topbar + KPI + Mini Bar Chart + Mini Table) */}
                  <div
                    style={{
                      backgroundColor: t.bgCanvas,
                      borderColor: t.border,
                    }}
                    className="rounded-xl border overflow-hidden flex h-36 shadow-xs"
                  >
                    {/* Mini RTL Sidebar (Right side) */}
                    <div
                      style={{
                        backgroundColor: t.sidebarBg,
                        borderLeft: `1px solid ${t.sidebarBorder}`,
                      }}
                      className="w-12 p-1.5 flex flex-col justify-between shrink-0"
                    >
                      <div className="space-y-1.5">
                        <div
                          style={{ backgroundColor: t.sidebarText }}
                          className="h-1.5 w-7 rounded-sm opacity-80 mb-2"
                        />
                        <div
                          style={{ backgroundColor: t.sidebarActiveBg }}
                          className="h-3 w-full rounded px-1 flex items-center"
                        >
                          <div className="h-1 w-5 bg-white rounded-full" />
                        </div>
                        <div
                          style={{ backgroundColor: t.sidebarText }}
                          className="h-1.5 w-8 rounded-sm opacity-35"
                        />
                        <div
                          style={{ backgroundColor: t.sidebarText }}
                          className="h-1.5 w-6 rounded-sm opacity-35"
                        />
                        <div
                          style={{ backgroundColor: t.sidebarText }}
                          className="h-1.5 w-7 rounded-sm opacity-35"
                        />
                      </div>
                      <div
                        style={{ backgroundColor: t.primary }}
                        className="h-2.5 w-full rounded opacity-90"
                      />
                    </div>

                    {/* Mini Workspace Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Mini Top Header */}
                      <div
                        style={{
                          backgroundColor: t.bgSurface,
                          borderBottom: `1px solid ${t.border}`,
                        }}
                        className="h-5 px-2 flex items-center justify-between"
                      >
                        <div
                          style={{ backgroundColor: t.textPrimary }}
                          className="h-1.5 w-12 rounded-sm opacity-75"
                        />
                        <div className="flex items-center gap-1">
                          <div
                            style={{ backgroundColor: t.primarySoft }}
                            className="w-2.5 h-2.5 rounded-full"
                          />
                          <div
                            style={{ backgroundColor: t.primary }}
                            className="h-2.5 w-6 rounded-sm"
                          />
                        </div>
                      </div>

                      {/* Mini Content: 2 KPI Cards + Mini Bar Chart & Mini Table */}
                      <div className="p-1.5 space-y-1.5 flex-1 flex flex-col justify-between">
                        {/* Mini KPI Row */}
                        <div className="grid grid-cols-3 gap-1">
                          {[t.primary, t.chart2, t.chart3].map((clr, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: t.bgSurface,
                                borderColor: t.border,
                              }}
                              className="p-1 rounded border flex items-center justify-between"
                            >
                              <div
                                style={{ backgroundColor: t.textPrimary }}
                                className="h-1.5 w-4 rounded-sm"
                              />
                              <div
                                style={{ backgroundColor: clr }}
                                className="w-2 h-2 rounded-xs"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Mini Chart + Mini Table Split */}
                        <div className="grid grid-cols-12 gap-1 flex-1">
                          {/* Mini Vertical Bar Chart (5 cols) */}
                          <div
                            style={{
                              backgroundColor: t.bgSurface,
                              borderColor: t.border,
                            }}
                            className="col-span-5 p-1.5 rounded border flex items-end justify-around gap-1"
                          >
                            <div
                              style={{ backgroundColor: t.chart1, height: '85%' }}
                              className="w-2 rounded-t-xs"
                            />
                            <div
                              style={{ backgroundColor: t.chart2, height: '60%' }}
                              className="w-2 rounded-t-xs"
                            />
                            <div
                              style={{ backgroundColor: t.chart3, height: '95%' }}
                              className="w-2 rounded-t-xs"
                            />
                          </div>

                          {/* Mini Table Rows (7 cols) */}
                          <div
                            style={{
                              backgroundColor: t.bgSurface,
                              borderColor: t.border,
                            }}
                            className="col-span-7 p-1.5 rounded border flex flex-col justify-between"
                          >
                            <div
                              style={{ backgroundColor: t.bgSubtle }}
                              className="h-2 w-full rounded-xs px-1 flex items-center justify-between"
                            >
                              <div
                                style={{ backgroundColor: t.textMuted }}
                                className="h-1 w-6 rounded-xs opacity-60"
                              />
                              <div
                                style={{ backgroundColor: t.primary }}
                                className="h-1 w-3 rounded-xs"
                              />
                            </div>
                            <div className="flex items-center justify-between px-0.5">
                              <div
                                style={{ backgroundColor: t.textSecondary }}
                                className="h-1 w-8 rounded-xs opacity-65"
                              />
                              <div
                                style={{ backgroundColor: t.chart3 }}
                                className="h-1.5 w-3 rounded-xs"
                              />
                            </div>
                            <div className="flex items-center justify-between px-0.5">
                              <div
                                style={{ backgroundColor: t.textSecondary }}
                                className="h-1 w-7 rounded-xs opacity-50"
                              />
                              <div
                                style={{ backgroundColor: t.chart2 }}
                                className="h-1.5 w-3 rounded-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body: Theme Identity & Psychology */}
                <div className="p-3.5 space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <h3
                        style={{ color: t.textPrimary }}
                        className="text-xs sm:text-sm font-extrabold truncate"
                      >
                        {preset.persianName}
                      </h3>
                    </div>
                    <div
                      style={{ color: t.primary }}
                      className="text-[10px] font-bold mt-0.5"
                    >
                      {preset.shortTagline}
                    </div>
                    <p
                      style={{ color: t.textSecondary }}
                      className="text-[11px] leading-relaxed mt-1.5 opacity-90 line-clamp-3"
                    >
                      {preset.psychologyDescription}
                    </p>
                  </div>

                  {/* Primary / Canvas / Sidebar / Surface Hex Swatches */}
                  <div
                    style={{ borderColor: t.border }}
                    className="pt-2 border-t flex items-center justify-between"
                  >
                    <span
                      style={{ color: t.textMuted }}
                      className="text-[10px] font-mono dir-ltr"
                    >
                      {t.primary} · {t.bgCanvas}
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { color: t.primary, label: 'Primary' },
                        { color: t.bgCanvas, label: 'Canvas' },
                        { color: t.sidebarBg, label: 'Sidebar' },
                        { color: t.bgSurface, label: 'Surface' },
                      ].map((sw, idx) => (
                        <span
                          key={idx}
                          title={`${sw.label}: ${sw.color}`}
                          style={{
                            backgroundColor: sw.color,
                            borderColor: t.border,
                          }}
                          className="w-4 h-4 rounded-full border shadow-2xs inline-block"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Action Footer */}
              <div
                style={{
                  backgroundColor: t.bgSubtle,
                  borderTop: `1px solid ${t.border}`,
                }}
                className="p-2.5 space-y-1.5"
              >
                {preset.id === 'custom-org' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCustomBuilder(true)}
                      style={{
                        backgroundColor: t.bgSurface,
                        borderColor: t.border,
                        color: t.textPrimary,
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg border py-1.5 px-2 text-[11px] font-bold hover:opacity-90 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>انتخاب رنگ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDirectApply(preset, false)}
                      style={{
                        backgroundColor: t.primary,
                        color: '#FFFFFF',
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[11px] font-bold hover:opacity-95 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>{isSelected ? 'فعال' : 'اعمال تم'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onStartPreview(preset.id)}
                      style={{
                        backgroundColor: t.bgSurface,
                        borderColor: t.border,
                        color: t.textPrimary,
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg border py-1.5 px-2 text-[11px] font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>پیش‌نمایش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectApply(preset, false)}
                      style={{
                        backgroundColor: t.primary,
                        color: '#FFFFFF',
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[11px] font-bold hover:opacity-95 transition-opacity cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>{isSelected ? 'پوسته فعال' : 'اعمال تم'}</span>
                    </button>
                  </div>
                )}

                {!isOrgDefault && (
                  <button
                    type="button"
                    onClick={() => handleDirectApply(preset, true)}
                    style={{ color: t.textMuted }}
                    className="w-full text-center text-[10px] font-semibold hover:underline pt-0.5 cursor-pointer"
                  >
                    تنظیم به عنوان تم پیش‌فرض کل سازمان
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ThemeGalleryModal: React.FC<
  ThemeGalleryViewProps & {
    isOpen: boolean;
    onClose: () => void;
  }
> = ({ isOpen, onClose, ...galleryProps }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              گالری پوسته‌های آماده سامانه (۱۰ تم اختصاصی با پیش‌نمایش زنده)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <ThemeGalleryView {...galleryProps} compactMode={false} />
        </div>
      </div>
    </div>
  );
};

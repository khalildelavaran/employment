import crypto from 'crypto';
import type { D1DatabaseAdapter } from '../db/d1Adapter.ts';
import type {
  CustomSmsTemplateRecord,
  CustomSmsTriggerKey,
  FarazLineItem,
  FarazPatternItem,
  FarazProviderStatus,
  SmsEventKey,
  SmsLogRecord,
  SmsLogsSummary,
  SmsSendMode,
  SmsSettingsConfig,
  SmsTemplateConfig,
} from '../types/recruitment.ts';
import { CUSTOM_SMS_TRIGGER_OPTIONS } from '../types/recruitment.ts';
import { getCurrentJalaliDateTime, toEnglishDigits, validateIranianMobile } from '../utils/validation.ts';

export const DEFAULT_SMS_TEMPLATES: Record<SmsEventKey, SmsTemplateConfig> = {
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

export function getDefaultSmsSettings(): SmsSettingsConfig {
  return {
    sms_enabled: true,
    send_mode: 'pattern',
    line_number: process.env.FARAZSMS_LINE_NUMBER || '',
    number_format: 'persian',
    admin_mobile: '',
    applicant_2fa_enabled: true,
    admin_2fa_enabled: false,
    otp_expiry_seconds: 120,
    otp_resend_seconds: 60,
    templates: structuredClone(DEFAULT_SMS_TEMPLATES),
    updated_at_jalali: '',
  };
}

export function getFarazRuntimeConfig(): {
  baseUrl: string;
  apiKey: string;
  keyTitle: string;
  maskedKey: string;
  configured: boolean;
} {
  const baseUrl = (process.env.FARAZSMS_BASE_URL || 'https://api.iranpayamak.com').replace(/\/+$/, '');
  const apiKey = (process.env.FARAZSMS_API_KEY || '').trim();
  const keyTitle = (process.env.FARAZSMS_KEY_TITLE || 'emloyment').trim();
  const maskedKey =
    apiKey.length >= 10
      ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`
      : apiKey
      ? '••••••••'
      : '';
  return {
    baseUrl,
    apiKey,
    keyTitle,
    maskedKey,
    configured: apiKey.length > 0,
  };
}

export function maskMobileNumber(mobile: string): string {
  const clean = toEnglishDigits(mobile).trim();
  if (clean.length === 11) {
    return `${clean.slice(0, 4)}•••${clean.slice(-4)}`;
  }
  return clean;
}

export function normalizeSmsTemplates(raw: unknown): Record<SmsEventKey, SmsTemplateConfig> {
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, Partial<SmsTemplateConfig>>) : {};
  const keys: SmsEventKey[] = ['OTP', 'REGISTRATION_SUCCESS', 'STATUS_AND_INTERVIEW', 'ADMIN_NEW_APPLICANT'];
  const result = {} as Record<SmsEventKey, SmsTemplateConfig>;
  for (const key of keys) {
    const def = DEFAULT_SMS_TEMPLATES[key];
    const item = parsed[key] || {};
    result[key] = {
      enabled: item.enabled !== undefined ? Boolean(item.enabled) : def.enabled,
      send_mode_override:
        item.send_mode_override === 'pattern' || item.send_mode_override === 'text'
          ? item.send_mode_override
          : 'default',
      pattern_code: typeof item.pattern_code === 'string' ? item.pattern_code.trim() : def.pattern_code,
      pattern_var_map:
        item.pattern_var_map && typeof item.pattern_var_map === 'object'
          ? { ...item.pattern_var_map }
          : { ...def.pattern_var_map },
      text_template:
        typeof item.text_template === 'string' && item.text_template.trim().length > 0
          ? item.text_template
          : def.text_template,
    };
  }
  return result;
}

export function getSmsSettingsRow(db: D1DatabaseAdapter): SmsSettingsConfig {
  const row = db.prepare('SELECT * FROM sms_settings WHERE id = 1').first<Record<string, unknown>>();
  if (!row) {
    return getDefaultSmsSettings();
  }
  let parsedTemplates: unknown = {};
  try {
    parsedTemplates = JSON.parse(String(row.templates_json || '{}'));
  } catch {
    parsedTemplates = {};
  }
  return {
    sms_enabled: Number(row.sms_enabled) === 1,
    send_mode: row.send_mode === 'text' ? 'text' : 'pattern',
    line_number: String(row.line_number || process.env.FARAZSMS_LINE_NUMBER || ''),
    number_format: row.number_format === 'english' ? 'english' : 'persian',
    admin_mobile: String(row.admin_mobile || ''),
    applicant_2fa_enabled: Number(row.applicant_2fa_enabled) === 1,
    admin_2fa_enabled: Number(row.admin_2fa_enabled) === 1,
    otp_expiry_seconds: Math.max(60, Math.min(600, Number(row.otp_expiry_seconds || 120))),
    otp_resend_seconds: Math.max(30, Math.min(300, Number(row.otp_resend_seconds || 60))),
    templates: normalizeSmsTemplates(parsedTemplates),
    updated_at_jalali: String(row.updated_at_jalali || ''),
  };
}

export function saveSmsSettingsRow(db: D1DatabaseAdapter, input: Partial<SmsSettingsConfig>): SmsSettingsConfig {
  const current = getSmsSettingsRow(db);
  const nowJalali = getCurrentJalaliDateTime();
  const next: SmsSettingsConfig = {
    sms_enabled: input.sms_enabled !== undefined ? Boolean(input.sms_enabled) : current.sms_enabled,
    send_mode: input.send_mode === 'text' || input.send_mode === 'pattern' ? input.send_mode : current.send_mode,
    line_number:
      input.line_number !== undefined ? toEnglishDigits(String(input.line_number)).trim() : current.line_number,
    number_format:
      input.number_format === 'english' || input.number_format === 'persian'
        ? input.number_format
        : current.number_format,
    admin_mobile:
      input.admin_mobile !== undefined ? toEnglishDigits(String(input.admin_mobile)).trim() : current.admin_mobile,
    applicant_2fa_enabled:
      input.applicant_2fa_enabled !== undefined
        ? Boolean(input.applicant_2fa_enabled)
        : current.applicant_2fa_enabled,
    admin_2fa_enabled:
      input.admin_2fa_enabled !== undefined ? Boolean(input.admin_2fa_enabled) : current.admin_2fa_enabled,
    otp_expiry_seconds:
      input.otp_expiry_seconds !== undefined
        ? Math.max(60, Math.min(600, Number(input.otp_expiry_seconds) || 120))
        : current.otp_expiry_seconds,
    otp_resend_seconds:
      input.otp_resend_seconds !== undefined
        ? Math.max(30, Math.min(300, Number(input.otp_resend_seconds) || 60))
        : current.otp_resend_seconds,
    templates: input.templates ? normalizeSmsTemplates(input.templates) : current.templates,
    updated_at_jalali: nowJalali,
  };

  const exists = db.prepare('SELECT id FROM sms_settings WHERE id = 1').first<{ id: number }>();
  if (!exists) {
    db.prepare(
      `INSERT INTO sms_settings (
        id, sms_enabled, send_mode, line_number, number_format, admin_mobile,
        applicant_2fa_enabled, admin_2fa_enabled, otp_expiry_seconds, otp_resend_seconds,
        templates_json, updated_at_jalali
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        next.sms_enabled ? 1 : 0,
        next.send_mode,
        next.line_number,
        next.number_format,
        next.admin_mobile,
        next.applicant_2fa_enabled ? 1 : 0,
        next.admin_2fa_enabled ? 1 : 0,
        next.otp_expiry_seconds,
        next.otp_resend_seconds,
        JSON.stringify(next.templates),
        next.updated_at_jalali
      )
      .run();
  } else {
    db.prepare(
      `UPDATE sms_settings SET
        sms_enabled = ?,
        send_mode = ?,
        line_number = ?,
        number_format = ?,
        admin_mobile = ?,
        applicant_2fa_enabled = ?,
        admin_2fa_enabled = ?,
        otp_expiry_seconds = ?,
        otp_resend_seconds = ?,
        templates_json = ?,
        updated_at_jalali = ?
       WHERE id = 1`
    )
      .bind(
        next.sms_enabled ? 1 : 0,
        next.send_mode,
        next.line_number,
        next.number_format,
        next.admin_mobile,
        next.applicant_2fa_enabled ? 1 : 0,
        next.admin_2fa_enabled ? 1 : 0,
        next.otp_expiry_seconds,
        next.otp_resend_seconds,
        JSON.stringify(next.templates),
        next.updated_at_jalali
      )
      .run();
  }
  return next;
}

export function renderSmsTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/%([a-zA-Z0-9_]+)%/g, (_match, key: string) => {
    const val = variables[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}

async function farazFetch(
  endpointPath: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: unknown; rawText: string; error?: string }> {
  const cfg = getFarazRuntimeConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      status: 0,
      data: null,
      rawText: '',
      error: 'کلید دسترسی فراز اس‌ام‌اس (FARAZSMS_API_KEY) در متغیرهای محیطی سرور تنظیم نشده است.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const url = `${cfg.baseUrl}${endpointPath}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Api-Key': cfg.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const rawText = await res.text();
    let data: unknown = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!res.ok) {
      const errObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
      const msg =
        (errObj && (errObj.message || errObj.error || (errObj.meta as Record<string, unknown> | undefined)?.message)) ||
        `خطای وب‌سرویس فراز اس‌ام‌اس (کد ${res.status})`;
      return { ok: false, status: res.status, data, rawText, error: String(msg) };
    }

    // Check FarazSMS logical error payloads even when HTTP 200
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.status === 'error' || obj.success === false) {
        const msg = obj.message || obj.error || 'خطا در پردازش درخواست توسط فراز اس‌ام‌اس';
        return { ok: false, status: res.status, data, rawText, error: String(msg) };
      }
    }

    return { ok: true, status: res.status, data, rawText };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      rawText: '',
      error: isAbort
        ? 'پاسخ‌گویی وب‌سرویس فراز اس‌ام‌اس بیش از حد طولانی شد (Timeout).'
        : err instanceof Error
        ? `خطای شبکه در اتصال به فراز اس‌ام‌اس: ${err.message}`
        : 'خطای ناشناخته در ارتباط با فراز اس‌ام‌اس',
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) return Number(val);
  return null;
}

function parseBalanceResponse(data: unknown): number | null {
  const direct = extractNumber(data);
  if (direct !== null) return direct;
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  for (const key of ['balance_amount', 'balance', 'credit', 'amount', 'wallet', 'data']) {
    if (key in obj) {
      const found = parseBalanceResponse(obj[key]);
      if (found !== null) return found;
    }
  }
  return null;
}

function parseLinesResponse(data: unknown): FarazLineItem[] {
  const arr = findFirstArray(data);
  const items: FarazLineItem[] = [];
  for (const raw of arr) {
    if (typeof raw === 'string' || typeof raw === 'number') {
      items.push({ number: String(raw) });
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const num = obj.number || obj.line_number || obj.line || obj.from || obj.value;
      if (num) {
        items.push({
          number: String(num),
          title: obj.title ? String(obj.title) : obj.name ? String(obj.name) : undefined,
          is_dedicated: Boolean(obj.is_dedicated),
        });
      }
    }
  }
  return items;
}

function parsePatternsResponse(data: unknown): FarazPatternItem[] {
  const arr = findFirstArray(data);
  const items: FarazPatternItem[] = [];
  for (const raw of arr) {
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const code = obj.code || obj.pattern_code || obj.uid || obj.id;
      const text = String(obj.text || obj.message || obj.body || '');
      if (code) {
        const extractedVars = Array.from(new Set(Array.from(text.matchAll(/%([a-zA-Z0-9_]+)%/g)).map((m) => m[1])));
        const rawVars = Array.isArray(obj.vars)
          ? obj.vars
              .map((v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? String((v as Record<string, unknown>).var || '') : ''))
              .filter(Boolean)
          : extractedVars;
        items.push({
          code: String(code),
          text,
          status: obj.status ? String(obj.status) : undefined,
          vars: rawVars.length > 0 ? rawVars : extractedVars,
        });
      }
    }
  }
  return items;
}

function findFirstArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of ['data', 'items', 'lines', 'patterns', 'results', 'list']) {
    if (key in obj) {
      const nested = findFirstArray(obj[key]);
      if (nested.length > 0 || Array.isArray(obj[key])) return nested;
    }
  }
  return [];
}

let cachedDefaultLine: { number: string; fetchedAt: number } | null = null;

export async function fetchFarazProviderStatus(): Promise<FarazProviderStatus> {
  const cfg = getFarazRuntimeConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      connected: false,
      base_url: cfg.baseUrl,
      key_title: cfg.keyTitle,
      masked_key: '',
      balance_toman: null,
      lines: [],
      patterns: [],
      error: 'کلید دسترسی فراز اس‌ام‌اس تنظیم نشده است.',
    };
  }

  const [balRes, linesRes, patternsRes] = await Promise.all([
    farazFetch('/ws/v1/account/balance', { method: 'GET' }),
    farazFetch('/ws/v1/lines/accessible', { method: 'GET' }),
    farazFetch('/ws/v1/patterns', { method: 'GET' }),
  ]);

  const balance = balRes.ok ? parseBalanceResponse(balRes.data) : null;
  const lines = linesRes.ok ? parseLinesResponse(linesRes.data) : [];
  const patterns = patternsRes.ok ? parsePatternsResponse(patternsRes.data) : [];

  if (lines.length > 0) {
    cachedDefaultLine = { number: lines[0].number, fetchedAt: Date.now() };
  }

  const connected = balRes.ok || linesRes.ok;
  const firstError = !connected ? balRes.error || linesRes.error || 'اتصال به فراز اس‌ام‌اس برقرار نشد.' : undefined;

  return {
    configured: true,
    connected,
    base_url: cfg.baseUrl,
    key_title: cfg.keyTitle,
    masked_key: cfg.maskedKey,
    balance_toman: balance,
    lines,
    patterns,
    error: firstError,
  };
}

async function resolveLineNumber(settings: SmsSettingsConfig): Promise<string> {
  if (settings.line_number && settings.line_number.trim()) {
    return toEnglishDigits(settings.line_number).trim();
  }
  if (process.env.FARAZSMS_LINE_NUMBER && process.env.FARAZSMS_LINE_NUMBER.trim()) {
    return toEnglishDigits(process.env.FARAZSMS_LINE_NUMBER).trim();
  }
  if (cachedDefaultLine && Date.now() - cachedDefaultLine.fetchedAt < 10 * 60 * 1000) {
    return cachedDefaultLine.number;
  }
  const linesRes = await farazFetch('/ws/v1/lines/accessible', { method: 'GET', timeoutMs: 6000 });
  if (linesRes.ok) {
    const lines = parseLinesResponse(linesRes.data);
    if (lines.length > 0) {
      cachedDefaultLine = { number: lines[0].number, fetchedAt: Date.now() };
      return lines[0].number;
    }
  }
  // FarazSMS shared default line fallback documented in API spec
  return '90008361';
}

function logSmsAttempt(
  db: D1DatabaseAdapter,
  entry: Omit<SmsLogRecord, 'id' | 'created_at_jalali'>
): number {
  const nowJalali = getCurrentJalaliDateTime();
  const ins = db
    .prepare(
      `INSERT INTO sms_logs (
        event_type, recipient_mobile, send_mode, line_number, pattern_code,
        message_text, status, provider_ref, provider_response, error_message, created_at_jalali
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.event_type,
      entry.recipient_mobile,
      entry.send_mode,
      entry.line_number,
      entry.pattern_code,
      entry.message_text,
      entry.status,
      entry.provider_ref,
      entry.provider_response.slice(0, 600),
      entry.error_message.slice(0, 400),
      nowJalali
    )
    .run();
  return ins.meta.last_row_id;
}

function extractProviderRef(data: unknown): string {
  if (typeof data === 'number' || typeof data === 'string') return String(data);
  if (Array.isArray(data) && data.length > 0) return String(data[0]);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const k of ['data', 'id', 'message_id', 'bulk_id', 'ref', 'result']) {
      if (obj[k] !== undefined && obj[k] !== null) {
        if (typeof obj[k] === 'string' || typeof obj[k] === 'number') return String(obj[k]);
        if (Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 0) return String((obj[k] as unknown[])[0]);
      }
    }
  }
  return '';
}

export interface SmsDispatchResult {
  sent: boolean;
  skipped?: boolean;
  mode: SmsSendMode;
  line_number: string;
  provider_ref?: string;
  error?: string;
  log_id: number;
}

export async function dispatchRecruitmentSms(
  db: D1DatabaseAdapter,
  eventType: SmsEventKey | 'TEST_SMS',
  recipientMobile: string,
  variables: Record<string, string>,
  options?: {
    customText?: string;
    forceEnabled?: boolean;
    overrideMode?: SmsSendMode;
    overridePatternCode?: string;
  }
): Promise<SmsDispatchResult> {
  const settings = getSmsSettingsRow(db);
  const cleanMobile = toEnglishDigits(recipientMobile || '').trim();
  const mobVal = validateIranianMobile(cleanMobile);

  const templateCfg =
    eventType !== 'TEST_SMS'
      ? settings.templates[eventType]
      : {
          enabled: true,
          send_mode_override: 'default' as const,
          pattern_code: options?.overridePatternCode || '',
          pattern_var_map: {},
          text_template: options?.customText || 'پیامک آزمایشی سامانه استخدام شرکت دستوا (فراز اس‌ام‌اس)',
        };

  const renderedText = options?.customText
    ? renderSmsTemplate(options.customText, variables)
    : renderSmsTemplate(templateCfg.text_template, variables);

  if (!mobVal.valid) {
    const logId = logSmsAttempt(db, {
      event_type: eventType,
      recipient_mobile: cleanMobile || 'نامشخص',
      send_mode: settings.send_mode,
      line_number: settings.line_number,
      pattern_code: templateCfg.pattern_code,
      message_text: renderedText,
      status: 'failed',
      provider_ref: '',
      provider_response: '',
      error_message: mobVal.message || 'شماره موبایل گیرنده معتبر نیست.',
    });
    return { sent: false, mode: settings.send_mode, line_number: settings.line_number, error: mobVal.message, log_id: logId };
  }

  if (!options?.forceEnabled && (!settings.sms_enabled || !templateCfg.enabled)) {
    const logId = logSmsAttempt(db, {
      event_type: eventType,
      recipient_mobile: cleanMobile,
      send_mode: settings.send_mode,
      line_number: settings.line_number,
      pattern_code: templateCfg.pattern_code,
      message_text: renderedText,
      status: 'skipped',
      provider_ref: '',
      provider_response: '',
      error_message: !settings.sms_enabled
        ? 'ارسال پیامک در تنظیمات سامانه غیرفعال است.'
        : 'ارسال پیامک برای این رویداد غیرفعال شده است.',
    });
    return { sent: false, skipped: true, mode: settings.send_mode, line_number: settings.line_number, log_id: logId };
  }

  const lineNumber = await resolveLineNumber(settings);
  const desiredMode: SmsSendMode =
    options?.overrideMode ||
    (templateCfg.send_mode_override !== 'default' ? templateCfg.send_mode_override : settings.send_mode);
  const patternCode = (options?.overridePatternCode ?? templateCfg.pattern_code ?? '').trim();

  // Use Pattern API when Pattern mode is chosen AND a pattern UID is configured; otherwise fall back cleanly to peer-to-peer text SMS
  const effectiveMode: SmsSendMode = desiredMode === 'pattern' && patternCode.length > 0 ? 'pattern' : 'text';

  let apiRes: { ok: boolean; status: number; data: unknown; rawText: string; error?: string };

  if (effectiveMode === 'pattern') {
    const attributes: Record<string, string> = {};
    const varMap = templateCfg.pattern_var_map || {};
    const mapEntries = Object.entries(varMap);
    if (mapEntries.length > 0) {
      for (const [patternVar, sourceVar] of mapEntries) {
        if (patternVar.trim()) {
          attributes[patternVar.trim()] = variables[sourceVar] ?? variables[patternVar] ?? '';
        }
      }
    } else {
      Object.assign(attributes, variables);
    }

    apiRes = await farazFetch('/ws/v1/sms/pattern', {
      method: 'POST',
      body: {
        code: patternCode,
        attributes,
        recipient: cleanMobile,
        line_number: lineNumber,
        number_format: settings.number_format,
      },
    });
  } else {
    apiRes = await farazFetch('/ws/v1/sms/peer-to-peer', {
      method: 'POST',
      body: {
        line_number: lineNumber,
        number_format: settings.number_format,
        peers: [
          {
            text: renderedText,
            recipients: [cleanMobile],
          },
        ],
        schedule: '',
      },
    });
  }

  const providerRef = apiRes.ok ? extractProviderRef(apiRes.data) : '';
  const logId = logSmsAttempt(db, {
    event_type: eventType,
    recipient_mobile: cleanMobile,
    send_mode: effectiveMode,
    line_number: lineNumber,
    pattern_code: effectiveMode === 'pattern' ? patternCode : '',
    message_text: renderedText,
    status: apiRes.ok ? 'sent' : 'failed',
    provider_ref: providerRef,
    provider_response: apiRes.rawText,
    error_message: apiRes.ok ? '' : apiRes.error || 'خطا در ارسال پیامک',
  });

  return {
    sent: apiRes.ok,
    mode: effectiveMode,
    line_number: lineNumber,
    provider_ref: providerRef,
    error: apiRes.ok ? undefined : apiRes.error,
    log_id: logId,
  };
}

// ============================================================================
// SERVER-SIDE OTP CHALLENGE HELPERS (2FA for Applicant Portal & Admin Login)
// ============================================================================

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function createAndSendOtpChallenge(
  db: D1DatabaseAdapter,
  params: { purpose: 'APPLICANT_ENTRY' | 'ADMIN_LOGIN'; mobile: string; national_code?: string }
): Promise<{
  ok: boolean;
  challenge_id?: string;
  masked_mobile?: string;
  expires_in?: number;
  resend_after?: number;
  sms_sent?: boolean;
  error?: string;
  retry_after_seconds?: number;
}> {
  const settings = getSmsSettingsRow(db);
  const cleanMob = toEnglishDigits(params.mobile).trim();
  const mobVal = validateIranianMobile(cleanMob);
  if (!mobVal.valid) {
    return { ok: false, error: mobVal.message || 'شماره موبایل معتبر نیست.' };
  }

  const nowMs = Date.now();
  const latest = db
    .prepare(
      `SELECT created_at_ms FROM otp_verifications
       WHERE mobile = ? AND purpose = ?
       ORDER BY id DESC LIMIT 1`
    )
    .bind(cleanMob, params.purpose)
    .first<{ created_at_ms: number }>();

  const cooldownMs = settings.otp_resend_seconds * 1000;
  if (latest && nowMs - latest.created_at_ms < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (nowMs - latest.created_at_ms)) / 1000);
    return {
      ok: false,
      retry_after_seconds: remaining,
      error: `لطفاً ${remaining} ثانیه دیگر برای ارسال مجدد کد تایید صبر کنید.`,
    };
  }

  // Clean up old expired challenges
  db.prepare('DELETE FROM otp_verifications WHERE expires_at < ?').bind(nowMs - 30 * 60 * 1000).run();

  const code = generateSixDigitOtp();
  const challengeId = crypto.randomBytes(18).toString('hex');
  const expiresAt = nowMs + settings.otp_expiry_seconds * 1000;

  db.prepare(
    `INSERT INTO otp_verifications (
      challenge_id, purpose, mobile, national_code, code, attempts, is_used, expires_at, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
  )
    .bind(challengeId, params.purpose, cleanMob, params.national_code || '', code, expiresAt, nowMs)
    .run();

  const dispatch = await dispatchRecruitmentSms(
    db,
    'OTP',
    cleanMob,
    {
      code,
      mobile: cleanMob,
      national_code: params.national_code || '',
      date: getCurrentJalaliDateTime(),
    },
    { forceEnabled: true }
  );

  if (!dispatch.sent) {
    return {
      ok: false,
      error: dispatch.error || 'ارسال پیامک کد تایید از طریق فراز اس‌ام‌اس ناموفق بود. لطفاً تنظیمات پیامکی را بررسی نمایید.',
    };
  }

  return {
    ok: true,
    challenge_id: challengeId,
    masked_mobile: maskMobileNumber(cleanMob),
    expires_in: settings.otp_expiry_seconds,
    resend_after: settings.otp_resend_seconds,
    sms_sent: true,
  };
}

export function verifyOtpChallenge(
  db: D1DatabaseAdapter,
  params: { challenge_id: string; code: string; purpose: 'APPLICANT_ENTRY' | 'ADMIN_LOGIN' }
): {
  valid: boolean;
  mobile?: string;
  national_code?: string;
  error?: string;
} {
  const cleanId = String(params.challenge_id || '').trim();
  const cleanCode = toEnglishDigits(String(params.code || '')).trim();

  if (!cleanId || cleanCode.length !== 6) {
    return { valid: false, error: 'لطفاً کد تایید ۶ رقمی را به‌درستی وارد نمایید.' };
  }

  const row = db
    .prepare('SELECT * FROM otp_verifications WHERE challenge_id = ? AND purpose = ?')
    .bind(cleanId, params.purpose)
    .first<{
      id: number;
      mobile: string;
      national_code: string;
      code: string;
      attempts: number;
      is_used: number;
      expires_at: number;
    }>();

  if (!row) {
    return { valid: false, error: 'نشست تایید هویت یافت نشد. لطفاً مجدداً درخواست کد دهید.' };
  }
  if (row.is_used === 1) {
    return { valid: false, error: 'این کد قبلاً استفاده شده است. لطفاً کد جدید درخواست کنید.' };
  }
  if (Date.now() > row.expires_at) {
    return { valid: false, error: 'مدت اعتبار کد تایید به پایان رسیده است. لطفاً مجدداً کد درخواست کنید.' };
  }
  if (row.attempts >= 5) {
    return { valid: false, error: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً کد جدید درخواست کنید.' };
  }

  if (row.code !== cleanCode) {
    db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    const remaining = Math.max(0, 4 - row.attempts);
    return {
      valid: false,
      error: `کد تایید واردشده صحیح نیست (${remaining} تلاش باقی‌مانده).`,
    };
  }

  db.prepare('UPDATE otp_verifications SET is_used = 1 WHERE id = ?').bind(row.id).run();
  return {
    valid: true,
    mobile: row.mobile,
    national_code: row.national_code,
  };
}

// ============================================================================
// CUSTOM SMS TEMPLATES CRUD & DISPATCH
// ============================================================================

const VALID_CUSTOM_TRIGGERS = new Set<string>(CUSTOM_SMS_TRIGGER_OPTIONS.map((o) => o.key));

function mapCustomTemplateRow(row: Record<string, unknown>): CustomSmsTemplateRecord {
  let varMap: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(row.pattern_var_map_json || '{}'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      varMap = parsed as Record<string, string>;
    }
  } catch {
    varMap = {};
  }
  const rawTrigger = String(row.trigger_key || 'CUSTOM');
  const triggerKey = (VALID_CUSTOM_TRIGGERS.has(rawTrigger) ? rawTrigger : 'CUSTOM') as CustomSmsTriggerKey;
  return {
    id: Number(row.id),
    title: String(row.title || ''),
    trigger_key: triggerKey,
    is_active: Number(row.is_active) === 1,
    send_mode: row.send_mode === 'pattern' ? 'pattern' : 'text',
    pattern_code: String(row.pattern_code || ''),
    pattern_var_map: varMap,
    text_template: String(row.text_template || ''),
    created_at_jalali: String(row.created_at_jalali || ''),
    updated_at_jalali: String(row.updated_at_jalali || ''),
  };
}

export interface CustomSmsTemplateInput {
  title?: string;
  trigger_key?: string;
  is_active?: boolean;
  send_mode?: string;
  pattern_code?: string;
  pattern_var_map?: Record<string, string>;
  text_template?: string;
}

export function listCustomSmsTemplates(db: D1DatabaseAdapter): CustomSmsTemplateRecord[] {
  const rows = db
    .prepare('SELECT * FROM sms_custom_templates ORDER BY id DESC')
    .all<Record<string, unknown>>().results;
  return rows.map(mapCustomTemplateRow);
}

export function getCustomSmsTemplateById(
  db: D1DatabaseAdapter,
  id: number
): CustomSmsTemplateRecord | null {
  const row = db
    .prepare('SELECT * FROM sms_custom_templates WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? mapCustomTemplateRow(row) : null;
}

export function createCustomSmsTemplate(
  db: D1DatabaseAdapter,
  input: CustomSmsTemplateInput
): { template?: CustomSmsTemplateRecord; error?: string } {
  const title = String(input.title || '').trim();
  const textTemplate = String(input.text_template || '').trim();
  const sendMode: SmsSendMode = input.send_mode === 'pattern' ? 'pattern' : 'text';
  const patternCode = String(input.pattern_code || '').trim();
  const rawTrigger = String(input.trigger_key || 'MANUAL_FOLLOWUP').trim();
  const triggerKey: CustomSmsTriggerKey = (
    VALID_CUSTOM_TRIGGERS.has(rawTrigger) ? rawTrigger : 'CUSTOM'
  ) as CustomSmsTriggerKey;

  if (!title || title.length < 2) {
    return { error: 'لطفاً عنوان معتبری برای قالب پیامک وارد نمایید.' };
  }
  if (sendMode === 'text' && !textTemplate) {
    return { error: 'متن پیامک برای قالب‌های متنی نمی‌تواند خالی باشد.' };
  }
  if (sendMode === 'pattern' && !patternCode && !textTemplate) {
    return { error: 'برای قالب پترنی، وارد کردن کد پترن یا متن جایگزین الزامی است.' };
  }

  const varMap: Record<string, string> = {};
  if (input.pattern_var_map && typeof input.pattern_var_map === 'object') {
    for (const [k, v] of Object.entries(input.pattern_var_map)) {
      const ck = k.trim();
      const cv = String(v || '').trim();
      if (ck && cv) varMap[ck] = cv;
    }
  }

  const nowJalali = getCurrentJalaliDateTime();
  const isActive = input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1;

  const ins = db
    .prepare(
      `INSERT INTO sms_custom_templates (
        title, trigger_key, is_active, send_mode, pattern_code, pattern_var_map_json,
        text_template, created_at_jalali, updated_at_jalali
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      title,
      triggerKey,
      isActive,
      sendMode,
      patternCode,
      JSON.stringify(varMap),
      textTemplate,
      nowJalali,
      nowJalali
    )
    .run();

  const created = getCustomSmsTemplateById(db, ins.meta.last_row_id);
  return created ? { template: created } : { error: 'خطا در ایجاد قالب پیامک.' };
}

export function updateCustomSmsTemplate(
  db: D1DatabaseAdapter,
  id: number,
  input: CustomSmsTemplateInput
): { template?: CustomSmsTemplateRecord; error?: string; notFound?: boolean } {
  const existing = getCustomSmsTemplateById(db, id);
  if (!existing) {
    return { notFound: true, error: 'قالب پیامک مورد نظر یافت نشد.' };
  }

  const title = input.title !== undefined ? String(input.title).trim() : existing.title;
  const textTemplate =
    input.text_template !== undefined ? String(input.text_template).trim() : existing.text_template;
  const sendMode: SmsSendMode =
    input.send_mode === 'pattern' || input.send_mode === 'text' ? input.send_mode : existing.send_mode;
  const patternCode =
    input.pattern_code !== undefined ? String(input.pattern_code).trim() : existing.pattern_code;
  const rawTrigger =
    input.trigger_key !== undefined ? String(input.trigger_key).trim() : existing.trigger_key;
  const triggerKey: CustomSmsTriggerKey = (
    VALID_CUSTOM_TRIGGERS.has(rawTrigger) ? rawTrigger : 'CUSTOM'
  ) as CustomSmsTriggerKey;
  const isActive = input.is_active !== undefined ? Boolean(input.is_active) : existing.is_active;

  if (!title || title.length < 2) {
    return { error: 'عنوان قالب پیامک نمی‌تواند کمتر از ۲ کاراکتر باشد.' };
  }
  if (sendMode === 'text' && !textTemplate) {
    return { error: 'متن پیامک برای قالب‌های متنی نمی‌تواند خالی باشد.' };
  }

  let varMap = existing.pattern_var_map;
  if (input.pattern_var_map && typeof input.pattern_var_map === 'object') {
    varMap = {};
    for (const [k, v] of Object.entries(input.pattern_var_map)) {
      const ck = k.trim();
      const cv = String(v || '').trim();
      if (ck && cv) varMap[ck] = cv;
    }
  }

  const nowJalali = getCurrentJalaliDateTime();
  db.prepare(
    `UPDATE sms_custom_templates SET
      title = ?,
      trigger_key = ?,
      is_active = ?,
      send_mode = ?,
      pattern_code = ?,
      pattern_var_map_json = ?,
      text_template = ?,
      updated_at_jalali = ?
     WHERE id = ?`
  )
    .bind(
      title,
      triggerKey,
      isActive ? 1 : 0,
      sendMode,
      patternCode,
      JSON.stringify(varMap),
      textTemplate,
      nowJalali,
      id
    )
    .run();

  const updated = getCustomSmsTemplateById(db, id);
  return updated ? { template: updated } : { error: 'خطا در به‌روزرسانی قالب پیامک.' };
}

export function deleteCustomSmsTemplate(db: D1DatabaseAdapter, id: number): boolean {
  const existing = getCustomSmsTemplateById(db, id);
  if (!existing) return false;
  db.prepare('DELETE FROM sms_custom_templates WHERE id = ?').bind(id).run();
  return true;
}

export async function sendCustomTemplateSms(
  db: D1DatabaseAdapter,
  templateId: number,
  recipientMobile: string,
  variables: Record<string, string>
): Promise<SmsDispatchResult & { notFound?: boolean }> {
  const tpl = getCustomSmsTemplateById(db, templateId);
  if (!tpl) {
    return {
      sent: false,
      notFound: true,
      mode: 'text',
      line_number: '',
      error: 'قالب پیامک انتخاب‌شده یافت نشد.',
      log_id: 0,
    };
  }

  const settings = getSmsSettingsRow(db);
  const cleanMobile = toEnglishDigits(recipientMobile || '').trim();
  const mobVal = validateIranianMobile(cleanMobile);
  const renderedText = renderSmsTemplate(tpl.text_template || tpl.title, variables);
  const eventLabel = `CUSTOM:${tpl.trigger_key}`;

  if (!mobVal.valid) {
    const logId = logSmsAttempt(db, {
      event_type: eventLabel,
      recipient_mobile: cleanMobile || 'نامشخص',
      send_mode: tpl.send_mode,
      line_number: settings.line_number,
      pattern_code: tpl.pattern_code,
      message_text: renderedText,
      status: 'failed',
      provider_ref: '',
      provider_response: '',
      error_message: mobVal.message || 'شماره موبایل گیرنده معتبر نیست.',
    });
    return {
      sent: false,
      mode: tpl.send_mode,
      line_number: settings.line_number,
      error: mobVal.message,
      log_id: logId,
    };
  }

  const lineNumber = await resolveLineNumber(settings);
  const effectiveMode: SmsSendMode =
    tpl.send_mode === 'pattern' && tpl.pattern_code.trim().length > 0 ? 'pattern' : 'text';

  let apiRes: { ok: boolean; status: number; data: unknown; rawText: string; error?: string };

  if (effectiveMode === 'pattern') {
    const attributes: Record<string, string> = {};
    const mapEntries = Object.entries(tpl.pattern_var_map || {});
    if (mapEntries.length > 0) {
      for (const [patternVar, sourceVar] of mapEntries) {
        if (patternVar.trim()) {
          attributes[patternVar.trim()] = variables[sourceVar] ?? variables[patternVar] ?? '';
        }
      }
    } else {
      Object.assign(attributes, variables);
    }

    apiRes = await farazFetch('/ws/v1/sms/pattern', {
      method: 'POST',
      body: {
        code: tpl.pattern_code.trim(),
        attributes,
        recipient: cleanMobile,
        line_number: lineNumber,
        number_format: settings.number_format,
      },
    });
  } else {
    apiRes = await farazFetch('/ws/v1/sms/peer-to-peer', {
      method: 'POST',
      body: {
        line_number: lineNumber,
        number_format: settings.number_format,
        peers: [
          {
            text: renderedText,
            recipients: [cleanMobile],
          },
        ],
        schedule: '',
      },
    });
  }

  const providerRef = apiRes.ok ? extractProviderRef(apiRes.data) : '';
  const logId = logSmsAttempt(db, {
    event_type: eventLabel,
    recipient_mobile: cleanMobile,
    send_mode: effectiveMode,
    line_number: lineNumber,
    pattern_code: effectiveMode === 'pattern' ? tpl.pattern_code.trim() : '',
    message_text: renderedText,
    status: apiRes.ok ? 'sent' : 'failed',
    provider_ref: providerRef,
    provider_response: apiRes.rawText,
    error_message: apiRes.ok ? '' : apiRes.error || 'خطا در ارسال پیامک',
  });

  return {
    sent: apiRes.ok,
    mode: effectiveMode,
    line_number: lineNumber,
    provider_ref: providerRef,
    error: apiRes.ok ? undefined : apiRes.error,
    log_id: logId,
  };
}

// ============================================================================
// DELIVERY LOGS SUMMARY & RETRY
// ============================================================================

export function getSmsLogsWithSummary(
  db: D1DatabaseAdapter,
  filters: { status?: string; event_type?: string; search?: string; limit?: number }
): { logs: SmsLogRecord[]; summary: SmsLogsSummary } {
  const allStatsRow = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped
       FROM sms_logs`
    )
    .first<{ total: number; sent: number; failed: number; skipped: number }>();

  const total = Number(allStatsRow?.total || 0);
  const sent = Number(allStatsRow?.sent || 0);
  const failed = Number(allStatsRow?.failed || 0);
  const skipped = Number(allStatsRow?.skipped || 0);
  const attempted = sent + failed;
  const deliveryRate = attempted > 0 ? Math.round((sent / attempted) * 100) : 100;

  const limit = Math.max(10, Math.min(300, Number(filters.limit || 200)));
  let rows = db
    .prepare(`SELECT * FROM sms_logs ORDER BY id DESC LIMIT ?`)
    .bind(limit)
    .all<SmsLogRecord>().results;

  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters.event_type && filters.event_type !== 'ALL') {
    if (filters.event_type === 'CUSTOM_ONLY') {
      rows = rows.filter((r) => String(r.event_type || '').startsWith('CUSTOM:'));
    } else {
      rows = rows.filter((r) => r.event_type === filters.event_type);
    }
  }
  if (filters.search && filters.search.trim()) {
    const q = toEnglishDigits(filters.search.trim()).toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.recipient_mobile || '').toLowerCase().includes(q) ||
        String(r.message_text || '').toLowerCase().includes(q) ||
        String(r.provider_ref || '').toLowerCase().includes(q) ||
        String(r.pattern_code || '').toLowerCase().includes(q) ||
        String(r.error_message || '').toLowerCase().includes(q)
    );
  }

  return {
    logs: rows,
    summary: {
      total,
      sent,
      failed,
      skipped,
      delivery_rate: deliveryRate,
    },
  };
}

export async function retrySmsLogEntry(
  db: D1DatabaseAdapter,
  logId: number
): Promise<(SmsDispatchResult & { notFound?: boolean })> {
  const row = db.prepare('SELECT * FROM sms_logs WHERE id = ?').bind(logId).first<SmsLogRecord>();
  if (!row) {
    return {
      sent: false,
      notFound: true,
      mode: 'text',
      line_number: '',
      error: 'رکورد پیامک مورد نظر یافت نشد.',
      log_id: 0,
    };
  }

  const settings = getSmsSettingsRow(db);
  const cleanMobile = toEnglishDigits(row.recipient_mobile || '').trim();
  const mobVal = validateIranianMobile(cleanMobile);
  if (!mobVal.valid) {
    return {
      sent: false,
      mode: 'text',
      line_number: row.line_number || settings.line_number,
      error: mobVal.message || 'شماره موبایل گیرنده معتبر نیست.',
      log_id: logId,
    };
  }

  const lineNumber = row.line_number || (await resolveLineNumber(settings));
  const messageText = row.message_text || 'پیامک سامانه استخدام شرکت دستوا';

  // Retry via Peer-to-Peer text endpoint so the exact original rendered text is redelivered reliably
  const apiRes = await farazFetch('/ws/v1/sms/peer-to-peer', {
    method: 'POST',
    body: {
      line_number: lineNumber,
      number_format: settings.number_format,
      peers: [
        {
          text: messageText,
          recipients: [cleanMobile],
        },
      ],
      schedule: '',
    },
  });

  const providerRef = apiRes.ok ? extractProviderRef(apiRes.data) : '';
  const newLogId = logSmsAttempt(db, {
    event_type: row.event_type || 'TEST_SMS',
    recipient_mobile: cleanMobile,
    send_mode: 'text',
    line_number: lineNumber,
    pattern_code: '',
    message_text: messageText,
    status: apiRes.ok ? 'sent' : 'failed',
    provider_ref: providerRef,
    provider_response: apiRes.rawText,
    error_message: apiRes.ok ? '' : apiRes.error || 'خطا در ارسال مجدد پیامک',
  });

  return {
    sent: apiRes.ok,
    mode: 'text',
    line_number: lineNumber,
    provider_ref: providerRef,
    error: apiRes.ok ? undefined : apiRes.error,
    log_id: newLogId,
  };
}


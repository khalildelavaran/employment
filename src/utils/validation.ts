const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

// Current Jalali Reference Year (November 2026 = Aban 1405)
export const CURRENT_JALALI_YEAR = 1405;
export const CURRENT_JALALI_MONTH = 8;
export const CURRENT_JALALI_DAY = 25;

export function toEnglishDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  let str = String(input);
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), String(i));
    str = str.replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
  }
  return str;
}

export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Validates Iranian 10-digit National Code (کد ملی) using the official modulo-11 checksum algorithm
 */
export function validateIranianNationalCode(rawCode: string): { valid: boolean; message?: string } {
  const code = toEnglishDigits(rawCode).trim();
  if (!code) {
    return { valid: false, message: 'وارد کردن کد ملی الزامی است.' };
  }
  if (!/^\d{10}$/.test(code)) {
    return { valid: false, message: 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.' };
  }
  // Reject repeated digits like 0000000000 or 1111111111
  if (/^(\d)\1{9}$/.test(code)) {
    return { valid: false, message: 'کد ملی واردشده معتبر نیست.' };
  }

  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(code[i]) * (10 - i);
  }
  const remainder = sum % 11;
  const isValid = (remainder < 2 && check === remainder) || (remainder >= 2 && check + remainder === 11);

  if (!isValid) {
    return { valid: false, message: 'کد ملی واردشده از نظر ساختار استاندارد معتبر نیست.' };
  }
  return { valid: true };
}

/**
 * Generates a valid 10-digit Iranian National Code from a 9-digit prefix (used for realistic seed data)
 */
export function makeValidNationalCode(nineDigits: string): string {
  const clean = toEnglishDigits(nineDigits).padStart(9, '1').slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(clean[i]) * (10 - i);
  }
  const rem = sum % 11;
  const check = rem < 2 ? rem : 11 - rem;
  return `${clean}${check}`;
}

/**
 * Validates Iranian Mobile Number (09xxxxxxxxx)
 */
export function validateIranianMobile(rawMobile: string): { valid: boolean; message?: string } {
  const mobile = toEnglishDigits(rawMobile).replace(/[\s-]/g, '');
  if (!mobile) {
    return { valid: false, message: 'وارد کردن شماره موبایل الزامی است.' };
  }
  if (!/^09\d{9}$/.test(mobile)) {
    return { valid: false, message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مانند ۰۹۱۲۳۴۵۶۷۸۹).' };
  }
  return { valid: true };
}

/**
 * Parses a Jalali birth date (YYYY/MM/DD) and calculates exact age
 */
export function calculateAgeFromJalali(birthDateJalali: string): {
  valid: boolean;
  age: number;
  birthYear: number;
  message?: string;
} {
  const normalized = toEnglishDigits(birthDateJalali).trim().replace(/-/g, '/');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return {
      valid: false,
      age: 0,
      birthYear: 0,
      message: 'فرمت تاریخ تولد باید به صورت شمسی (مثلاً ۱۳۷۸/۰۴/۱۵) باشد.',
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1320 || year > CURRENT_JALALI_YEAR - 15) {
    return {
      valid: false,
      age: 0,
      birthYear: year,
      message: `سال تولد باید بین ۱۳۲۰ تا ${toPersianDigits(CURRENT_JALALI_YEAR - 15)} باشد.`,
    };
  }
  if (month < 1 || month > 12) {
    return { valid: false, age: 0, birthYear: year, message: 'ماه تولد باید بین ۱ تا ۱۲ باشد.' };
  }
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 30;
  if (day < 1 || day > maxDay) {
    return { valid: false, age: 0, birthYear: year, message: 'روز تولد نامعتبر است.' };
  }

  let age = CURRENT_JALALI_YEAR - year;
  if (
    CURRENT_JALALI_MONTH < month ||
    (CURRENT_JALALI_MONTH === month && CURRENT_JALALI_DAY < day)
  ) {
    age -= 1;
  }

  return { valid: true, age, birthYear: year };
}

/**
 * Formats numbers with thousand separators in Persian
 */
export function formatToman(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '۰';
  const num = Number(toEnglishDigits(String(amount)).replace(/,/g, ''));
  if (isNaN(num)) return '۰';
  return toPersianDigits(num.toLocaleString('en-US'));
}

export function parseNumericInput(raw: string): number {
  const cleaned = toEnglishDigits(raw).replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function getCurrentJalaliDateTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${CURRENT_JALALI_YEAR}/08/25 - ${hh}:${mm}`);
}

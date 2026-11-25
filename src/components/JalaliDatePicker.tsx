import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CURRENT_JALALI_YEAR,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/validation.ts';

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const epBase = jy - (jy >= 0 ? 474 : 473);
  const epYear = 474 + (((epBase % 2820) + 2820) % 2820);
  return (
    jd +
    (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6) +
    Math.floor((epYear * 682 - 110) / 2816) +
    (epYear - 1) * 365 +
    Math.floor(epBase / 2820) * 1029983 +
    1948320
  );
}

function isJalaliLeapYear(jy: number): boolean {
  return jalaliToJdn(jy + 1, 1, 1) - jalaliToJdn(jy, 1, 1) === 366;
}

function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** Returns 0 = Saturday (شنبه) ... 6 = Friday (جمعه) */
function getJalaliMonthFirstWeekday(jy: number, jm: number): number {
  const jdn = jalaliToJdn(jy, jm, 1);
  return (((jdn + 2) % 7) + 7) % 7;
}

function parseJalaliParts(
  value: string
): { year: number; month: number; day: number } | null {
  const normalized = toEnglishDigits(value || '').trim().replace(/-/g, '/');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1300 || year > 1450 || month < 1 || month > 12) return null;
  const maxDay = daysInJalaliMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

function formatJalaliDate(year: number, month: number, day: number): string {
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

interface JalaliDatePickerProps {
  value: string;
  onChange: (nextValue: string) => void;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  hasError?: boolean;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  minYear = 1335,
  maxYear = CURRENT_JALALI_YEAR - 15,
  placeholder = '1379/04/15',
  hasError = false,
}) => {
  const parsed = parseJalaliParts(value);
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? 1378);
  const [viewMonth, setViewMonth] = useState<number>(parsed?.month ?? 4);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseJalaliParts(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  const totalDays = daysInJalaliMonth(viewYear, viewMonth);
  const firstWeekday = getJalaliMonthFirstWeekday(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      if (viewYear > minYear) {
        setViewYear(viewYear - 1);
        setViewMonth(12);
      }
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      if (viewYear < maxYear) {
        setViewYear(viewYear + 1);
        setViewMonth(1);
      }
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    onChange(formatJalaliDate(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(toEnglishDigits(e.target.value))}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${
            hasError
              ? 'border-rose-500 focus:border-rose-600'
              : 'border-slate-300 dark:border-slate-700 focus:border-blue-600'
          } bg-white dark:bg-slate-800 pl-3.5 pr-10 py-2 text-sm text-left tabular-nums focus:outline-none`}
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="باز کردن تقویم شمسی"
          className="absolute right-2.5 p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div
          dir="rtl"
          className="absolute right-0 z-40 mt-1.5 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3.5 space-y-3"
        >
          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="ماه قبل"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                {JALALI_MONTHS.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white tabular-nums cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="ماه بعد"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {WEEKDAY_SHORT.map((dayName, idx) => (
              <div key={dayName} className={`py-1 ${idx === 6 ? 'text-rose-500' : ''}`}>
                {dayName}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs tabular-nums">
            {Array.from({ length: firstWeekday }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8" />
            ))}
            {Array.from({ length: totalDays }, (_, idx) => idx + 1).map((day) => {
              const isSelected =
                parsed?.year === viewYear &&
                parsed?.month === viewMonth &&
                parsed?.day === day;
              const weekday = (firstWeekday + day - 1) % 7;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 rounded-lg font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                      : weekday === 6
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Footer Hint */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {parsed
                ? `انتخاب‌شده: ${toPersianDigits(parsed.day)} ${JALALI_MONTHS[parsed.month - 1]} ${toPersianDigits(parsed.year)}`
                : 'تاریخ تولد خود را انتخاب کنید'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import {
  ContactRecord,
  EducationRecord,
  WorkExperienceRecord,
} from '../types/recruitment.ts';
import { toEnglishDigits, toPersianDigits } from './validation.ts';

const DRAFT_KEY_PREFIX = 'dasteva_applicant_draft_v1:';
const ACTIVE_POINTER_KEY = 'dasteva_applicant_active_draft_v1';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ApplicantLocalDraft {
  version: 1;
  nationalCode: string;
  mobile: string;
  currentStep: number;
  highestReachedStep: number;
  isEditingSubmitted: boolean;
  firstName: string;
  lastName: string;
  gender: 'زن' | 'مرد';
  birthDateJalali: string;
  calculatedAge: number;
  maritalStatus: 'مجرد' | 'متأهل' | 'مطلقه';
  militaryStatus: string;
  fatherName: string;
  fatherAliveStatus: 'در قید حیات' | 'در قید حیات نیستند';
  fatherJob: string;
  educationList: EducationRecord[];
  city: string;
  districtInputMode: 'list' | 'manual';
  district: string;
  fullAddress: string;
  contactsList: ContactRecord[];
  hasWorkExperience: boolean;
  workList: WorkExperienceRecord[];
  acquaintanceSource: string;
  acquaintanceNote: string;
  proposedSalaryToman: number;
  resumeText: string;
  savedAt: number;
  lastSyncedAt: number | null;
  pendingServerSync: boolean;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeDraftKey(nationalCode: string): string {
  const clean = toEnglishDigits(String(nationalCode || '')).replace(/\D/g, '');
  return `${DRAFT_KEY_PREFIX}${clean || 'anonymous'}`;
}

function isValidDraftObject(raw: unknown): raw is ApplicantLocalDraft {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return false;
  if (typeof obj.savedAt !== 'number' || !Number.isFinite(obj.savedAt)) return false;
  if (typeof obj.currentStep !== 'number') return false;
  if (!Array.isArray(obj.educationList) || !Array.isArray(obj.contactsList) || !Array.isArray(obj.workList)) {
    return false;
  }
  return true;
}

function isDraftExpired(draft: ApplicantLocalDraft, now = Date.now()): boolean {
  return now - draft.savedAt > DRAFT_TTL_MS;
}

export function purgeExpiredApplicantDrafts(): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
      const rawText = storage.getItem(key);
      if (!rawText) {
        keysToRemove.push(key);
        continue;
      }
      try {
        const parsed = JSON.parse(rawText);
        if (!isValidDraftObject(parsed) || isDraftExpired(parsed, now)) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
    const activePointer = storage.getItem(ACTIVE_POINTER_KEY);
    for (const key of keysToRemove) {
      storage.removeItem(key);
      if (activePointer === key) {
        storage.removeItem(ACTIVE_POINTER_KEY);
      }
    }
  } catch {
    // Ignore storage read/delete errors
  }
}

export function saveApplicantDraft(
  draft: Omit<ApplicantLocalDraft, 'version' | 'savedAt'> & { savedAt?: number }
): { ok: boolean; savedAt: number } {
  const savedAt = draft.savedAt ?? Date.now();
  const storage = getSafeStorage();
  if (!storage) return { ok: false, savedAt };

  const record: ApplicantLocalDraft = {
    ...draft,
    version: 1,
    savedAt,
  };
  const key = makeDraftKey(draft.nationalCode);

  try {
    storage.setItem(key, JSON.stringify(record));
    storage.setItem(ACTIVE_POINTER_KEY, key);
    return { ok: true, savedAt };
  } catch {
    // Attempt cleanup of expired drafts once if QuotaExceededError
    purgeExpiredApplicantDrafts();
    try {
      storage.setItem(key, JSON.stringify(record));
      storage.setItem(ACTIVE_POINTER_KEY, key);
      return { ok: true, savedAt };
    } catch {
      return { ok: false, savedAt };
    }
  }
}

export function loadApplicantDraftByNationalCode(nationalCode: string): ApplicantLocalDraft | null {
  const storage = getSafeStorage();
  if (!storage) return null;
  const key = makeDraftKey(nationalCode);
  try {
    const rawText = storage.getItem(key);
    if (!rawText) return null;
    const parsed = JSON.parse(rawText);
    if (!isValidDraftObject(parsed) || isDraftExpired(parsed)) {
      storage.removeItem(key);
      if (storage.getItem(ACTIVE_POINTER_KEY) === key) {
        storage.removeItem(ACTIVE_POINTER_KEY);
      }
      return null;
    }
    return parsed;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return null;
  }
}

export function loadLastActiveApplicantDraft(): ApplicantLocalDraft | null {
  const storage = getSafeStorage();
  if (!storage) return null;
  try {
    const pointerKey = storage.getItem(ACTIVE_POINTER_KEY);
    if (!pointerKey || !pointerKey.startsWith(DRAFT_KEY_PREFIX)) return null;
    const rawText = storage.getItem(pointerKey);
    if (!rawText) {
      storage.removeItem(ACTIVE_POINTER_KEY);
      return null;
    }
    const parsed = JSON.parse(rawText);
    if (!isValidDraftObject(parsed) || isDraftExpired(parsed)) {
      storage.removeItem(pointerKey);
      storage.removeItem(ACTIVE_POINTER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markApplicantDraftSynced(nationalCode: string, syncedAt = Date.now()): void {
  const existing = loadApplicantDraftByNationalCode(nationalCode);
  if (!existing) return;
  saveApplicantDraft({
    ...existing,
    savedAt: existing.savedAt,
    lastSyncedAt: syncedAt,
    pendingServerSync: false,
  });
}

export function clearApplicantDraft(nationalCode?: string): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const activePointer = storage.getItem(ACTIVE_POINTER_KEY);
    if (nationalCode) {
      const key = makeDraftKey(nationalCode);
      storage.removeItem(key);
      if (activePointer === key) {
        storage.removeItem(ACTIVE_POINTER_KEY);
      }
    } else if (activePointer && activePointer.startsWith(DRAFT_KEY_PREFIX)) {
      storage.removeItem(activePointer);
      storage.removeItem(ACTIVE_POINTER_KEY);
    } else {
      storage.removeItem(ACTIVE_POINTER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function formatDraftClockPersian(timestamp: number | null): string {
  if (!timestamp) return '';
  try {
    const dt = new Date(timestamp);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return toPersianDigits(`${hh}:${mm}`);
  } catch {
    return '';
  }
}

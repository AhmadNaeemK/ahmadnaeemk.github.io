import { STORAGE_KEYS } from "./contract";

/** Storage can throw in a private window, so both directions are guarded. */
export function readSavedLivery(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.livery);
  } catch {
    return null;
  }
}

export function saveLivery(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.livery, id);
  } catch {
    // The choice still holds for this visit.
  }
}

import { ResumeData } from "@/types/resume";
import { SAMPLE_STUDENT_RESUME } from "./starter-data";

const STORAGE_KEY = "docutools_resume_draft_v1";

export function loadSavedResume(): ResumeData {
  if (typeof window === "undefined") {
    return SAMPLE_STUDENT_RESUME;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load saved resume from localStorage", e);
  }
  return SAMPLE_STUDENT_RESUME;
}

export function saveResume(data: ResumeData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to persist resume to localStorage", e);
  }
}

export function clearSavedResume(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear resume", e);
  }
}

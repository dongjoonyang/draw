export interface PracticeRecord {
  date: string; // YYYY-MM-DD
  poseCount: number;
  totalMinutes: number;
}

export interface SavedPoseImage {
  id: string;
  date: string; // YYYY-MM-DD
  imageUrl: string;
  guideMode: string;
  authorName: string;
  savedAt: string; // ISO timestamp
}

const STORAGE_KEY = "figure-drawing-practice";
const SAVED_IMAGES_KEY = "figure-drawing-saved-images";

export function getPracticeRecords(): PracticeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePracticeRecord(record: PracticeRecord): void {
  const records = getPracticeRecords();
  const existing = records.findIndex((r) => r.date === record.date);
  const updated =
    existing >= 0
      ? records.map((r, i) =>
          i === existing
            ? {
                date: r.date,
                poseCount: r.poseCount + record.poseCount,
                totalMinutes: r.totalMinutes + record.totalMinutes,
              }
            : r
        )
      : [...records, record];

  updated.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getTodayRecord(): PracticeRecord | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return getPracticeRecords().find((r) => r.date === today);
}

export function getSavedImages(): SavedPoseImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_IMAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePoseImage(image: SavedPoseImage): void {
  const images = getSavedImages();
  images.unshift(image);
  localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify(images));
}

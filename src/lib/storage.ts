export interface PracticeRecord {
  date: string; // YYYY-MM-DD
  poseCount: number;
  totalMinutes: number;
}

const STORAGE_KEY = "figure-drawing-practice";

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

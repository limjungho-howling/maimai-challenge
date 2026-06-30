const FIRST_WEEK_START_UTC = Date.UTC(2026, 5, 7, 22, 0, 0);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = WEEK_MS - 3 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface WeeklyChallengeWindow {
  endsAt: string;
  key: string;
  label: string;
  startsAt: string;
}

export function getCurrentWeeklyChallengeWindow(
  now = new Date(),
): WeeklyChallengeWindow | null {
  const time = now.getTime();
  if (time < FIRST_WEEK_START_UTC) {
    return null;
  }

  const weekIndex = Math.floor((time - FIRST_WEEK_START_UTC) / WEEK_MS);
  const startsAtUtc = FIRST_WEEK_START_UTC + weekIndex * WEEK_MS;
  const endsAtUtc = startsAtUtc + ACTIVE_WINDOW_MS;

  if (time < startsAtUtc || time >= endsAtUtc) {
    return null;
  }

  return buildWeeklyChallengeWindow(startsAtUtc);
}

export function getWeeklyChallengeWindowByKey(key: string): WeeklyChallengeWindow {
  const [year, month, day] = key.split("-").map(Number);
  const startsAtUtc = Date.UTC(year, month - 1, day, 22, 0, 0) - 24 * 60 * 60 * 1000;

  return buildWeeklyChallengeWindow(startsAtUtc);
}

export function formatWeeklyChallengeLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const labelDate = new Date(Date.UTC(year, month - 1, day + 3));
  const labelYear = labelDate.getUTCFullYear();
  const labelMonth = labelDate.getUTCMonth() + 1;
  const labelDay = labelDate.getUTCDate();
  const weekOfMonth = Math.ceil(labelDay / 7);

  return `${labelYear}년 ${labelMonth}월 ${weekOfMonth}주차`;
}

function buildWeeklyChallengeWindow(startsAtUtc: number): WeeklyChallengeWindow {
  const start = new Date(startsAtUtc);
  const key = formatKstDateKey(start);

  return {
    endsAt: formatKstIso(new Date(startsAtUtc + ACTIVE_WINDOW_MS)),
    key,
    label: formatWeeklyChallengeLabel(key),
    startsAt: formatKstIso(start),
  };
}

function formatKstDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatKstIso(date: Date): string {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = String(shifted.getUTCHours()).padStart(2, "0");
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  const second = String(shifted.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// 최초 기준: 2026-06-08 07:00 KST 시작, 월요일 04:00 KST 집계 종료.
const FIRST_WEEK_START_UTC = Date.UTC(2026, 5, 7, 22, 0, 0);
const LEGACY_ACTIVE_WINDOW_MS = WEEK_MS - 3 * HOUR_MS;

// 2026-09-07(9월 2주차)부터 마이마이 점검 시간 변경 반영:
// 월요일 01:00 KST까지 집계하고 02:00 KST에 새 주차를 시작한다.
// 전환 주차는 이미 07:00 KST에 시작했으므로 시작 시각은 유지하고 종료만 앞당긴다.
const TRANSITION_WEEK_START_UTC = Date.UTC(2026, 8, 6, 22, 0, 0); // 2026-09-07 07:00 KST
const NEW_SCHEDULE_START_UTC = Date.UTC(2026, 8, 13, 17, 0, 0); // 2026-09-14 02:00 KST
const NEW_ACTIVE_WINDOW_MS = WEEK_MS - HOUR_MS;
const TRANSITION_ACTIVE_WINDOW_MS =
  NEW_SCHEDULE_START_UTC - HOUR_MS - TRANSITION_WEEK_START_UTC;

// 신규 기준이 처음 적용되는 주차 키의 경계(이 날짜까지는 07:00 KST 시작).
const LAST_LEGACY_START_KEY_UTC = Date.UTC(2026, 8, 7);

export interface WeeklyChallengeWindow {
  endsAt: string;
  key: string;
  label: string;
  startsAt: string;
}

interface WeeklyChallengeSchedule {
  activeWindowMs: number;
  startsAtUtc: number;
}

export function getCurrentWeeklyChallengeWindow(
  now = new Date(),
): WeeklyChallengeWindow | null {
  const time = now.getTime();
  const schedule = resolveScheduleByTime(time);
  if (!schedule) {
    return null;
  }

  const endsAtUtc = schedule.startsAtUtc + schedule.activeWindowMs;
  if (time < schedule.startsAtUtc || time >= endsAtUtc) {
    return null;
  }

  return buildWeeklyChallengeWindow(schedule);
}

export function getWeeklyChallengeWindowByKey(key: string): WeeklyChallengeWindow {
  const [year, month, day] = key.split("-").map(Number);
  const usesNewSchedule = Date.UTC(year, month - 1, day) > LAST_LEGACY_START_KEY_UTC;
  // KST 월요일 02:00(신규) / 07:00(기존)은 UTC로는 전일 17:00 / 22:00 이다.
  const startsAtUtc =
    Date.UTC(year, month - 1, day, usesNewSchedule ? 17 : 22, 0, 0) - DAY_MS;

  return buildWeeklyChallengeWindow(resolveScheduleByStart(startsAtUtc));
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

function resolveScheduleByTime(time: number): WeeklyChallengeSchedule | null {
  if (time < FIRST_WEEK_START_UTC) {
    return null;
  }

  if (time < TRANSITION_WEEK_START_UTC) {
    const weekIndex = Math.floor((time - FIRST_WEEK_START_UTC) / WEEK_MS);
    return resolveScheduleByStart(FIRST_WEEK_START_UTC + weekIndex * WEEK_MS);
  }

  if (time < NEW_SCHEDULE_START_UTC) {
    return resolveScheduleByStart(TRANSITION_WEEK_START_UTC);
  }

  const weekIndex = Math.floor((time - NEW_SCHEDULE_START_UTC) / WEEK_MS);
  return resolveScheduleByStart(NEW_SCHEDULE_START_UTC + weekIndex * WEEK_MS);
}

function resolveScheduleByStart(startsAtUtc: number): WeeklyChallengeSchedule {
  if (startsAtUtc < TRANSITION_WEEK_START_UTC) {
    return { activeWindowMs: LEGACY_ACTIVE_WINDOW_MS, startsAtUtc };
  }

  if (startsAtUtc < NEW_SCHEDULE_START_UTC) {
    return { activeWindowMs: TRANSITION_ACTIVE_WINDOW_MS, startsAtUtc };
  }

  return { activeWindowMs: NEW_ACTIVE_WINDOW_MS, startsAtUtc };
}

function buildWeeklyChallengeWindow(
  schedule: WeeklyChallengeSchedule,
): WeeklyChallengeWindow {
  const start = new Date(schedule.startsAtUtc);
  const key = formatKstDateKey(start);

  return {
    endsAt: formatKstIso(new Date(schedule.startsAtUtc + schedule.activeWindowMs)),
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

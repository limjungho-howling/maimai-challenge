export const KST_TIME_ZONE = "Asia/Seoul";

const KST_OFFSET = "+09:00";

export function kstNowIsoString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: KST_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const millisecond = String(date.getMilliseconds()).padStart(3, "0");

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}.${millisecond}${KST_OFFSET}`;
}

export function formatKstDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: KST_TIME_ZONE,
  });
}

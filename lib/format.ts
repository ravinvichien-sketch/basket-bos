const BKK = "Asia/Bangkok";

/** "2026-07-08T19:00" (datetime-local, Bangkok) from an ISO string */
export function toBangkokInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** e.g. "พุธ 8 ก.ค. 19:00" */
export function formatThaiDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BKK,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** e.g. "19:00–21:00" */
export function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat("th-TH", {
    timeZone: BKK,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${fmt.format(new Date(startIso))}–${fmt.format(new Date(endIso))}`;
}

export function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString("th-TH")}`;
}

// The line of time shown on the page: the visitor's own, and the studio's in Jakarta.
// The visitor's is labelled with their time zone's short name (PST, CET, GMT+8...).
const hm = (now: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);

function zoneName(now: Date) {
  const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName");
  return (part?.value ?? "LOCAL").toUpperCase();
}

export function clockText(now: Date) {
  return `${zoneName(now)} ${hm(now)} | JKT ${hm(now, "Asia/Jakarta")}`;
}

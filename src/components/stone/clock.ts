// The line of time shown on the page: the visitor's own, and the studio's in Jakarta.
const hm = (now: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);

export function clockText(now: Date) {
  return `Local ${hm(now)} | JKT ${hm(now, "Asia/Jakarta")}`;
}

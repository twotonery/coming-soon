import { ZONES } from "./zones";

// The line of time shown on the page: the visitor's own, and the studio's in Jakarta.
// The visitor's is labelled with their country's code (US, UK, ID, SG...), found from
// the time zone their device is set to; nothing is asked of them.
const hm = (now: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);

let byZone: Map<string, string> | undefined;
function country() {
  if (!byZone) {
    byZone = new Map();
    for (const [code, zones] of Object.entries(ZONES)) for (const zone of zones.split(" ")) byZone.set(zone, code);
  }
  const code = byZone.get(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return code === "GB" ? "UK" : (code ?? "LOCAL");
}

export function clockText(now: Date) {
  return `${country()} ${hm(now)} | JKT ${hm(now, "Asia/Jakarta")}`;
}

import { ZONES } from "./zones";

// The line of time shown on the page: the visitor's own, and the studio's in Jakarta.
// The time is always the visitor's device's own. It is labelled with their city's code
// (DPS, SIN, LON...) when the site can tell where they are (see app/api/where), and
// otherwise with their country's code (ID, US, UK...), from their device's time zone.
const hm = (now: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

let byZone: Map<string, string> | undefined;
function country() {
  if (!byZone) {
    byZone = new Map();
    for (const [code, zones] of Object.entries(ZONES)) for (const zone of zones.split(" ")) byZone.set(zone, code);
  }
  const code = byZone.get(deviceZone());
  return code === "GB" ? "UK" : (code ?? "LOCAL");
}

// The city, asked of the site once. It is only used when the place it found keeps
// the same clock as the visitor's device: if not (a VPN, a phone still on home
// time), the city would be wrong for the time shown, so the country is used.
let city: string | null = null;
export async function findCity() {
  try {
    const res = await fetch("/api/where", { cache: "no-store" });
    if (!res.ok) return;
    const { code, timeZone } = (await res.json()) as { code: string | null; timeZone: string | null };
    if (!code || !timeZone) return;
    const now = new Date();
    if (hm(now, timeZone) === hm(now)) city = code;
  } catch { /* offline, or no such route: the country stands */ }
}

export function clockText(now: Date) {
  return `${city ?? country()} ${hm(now)} | JKT ${hm(now, "Asia/Jakarta")}`;
}

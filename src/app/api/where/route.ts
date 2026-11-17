import { AIRPORTS } from "./airports";

// Where the visitor is, as a city code for the page's clock: the code of the
// airport nearest to where their internet address places them (DPS in Bali, SIN
// in Singapore), or the city's own code where several airports serve one city
// (JKT, LON, NYC...). Vercel adds the location to each request; nothing is asked
// of the visitor, and nothing is kept. Also returns the time zone of that place,
// so the page can tell if it agrees with the visitor's own device.

// Cities served by more than one airport go by the city's code.
const METRO: Record<string, string> = {
  CGK: "JKT", HLP: "JKT", LHR: "LON", LGW: "LON", STN: "LON", LTN: "LON", LCY: "LON", SEN: "LON",
  JFK: "NYC", LGA: "NYC", EWR: "NYC", NRT: "TYO", HND: "TYO", CDG: "PAR", ORY: "PAR", BVA: "PAR",
  KIX: "OSA", ITM: "OSA", UKB: "OSA", ICN: "SEL", GMP: "SEL", PEK: "BJS", PKX: "BJS", PVG: "SHA",
  MXP: "MIL", LIN: "MIL", BGY: "MIL", FCO: "ROM", CIA: "ROM", IAD: "WAS", DCA: "WAS", BWI: "WAS",
  ORD: "CHI", MDW: "CHI", ARN: "STO", BMA: "STO", NYO: "STO", SVO: "MOW", DME: "MOW", VKO: "MOW",
  GRU: "SAO", CGH: "SAO", VCP: "SAO", GIG: "RIO", SDU: "RIO", YYZ: "YTO", YTZ: "YTO", YUL: "YMQ",
  EZE: "BUE", AEP: "BUE", DWC: "DXB", SAW: "IST", TSF: "VCE", DMK: "BKK", SZB: "KUL",
  BER: "BER", OSL: "OSL", TRF: "OSL", DTW: "DTT", HOU: "HOU", IAH: "HOU", MIA: "MIA", FLL: "MIA",
};

type Airport = { code: string; lat: number; lon: number; large: boolean };
let airports: Airport[] | undefined;
function list() {
  return (airports ??= AIRPORTS.split(";").map((row) => {
    const [code, lat, lon, kind] = row.split(",");
    return { code, lat: +lat, lon: +lon, large: kind === "L" };
  }));
}

// km between two points on the Earth
function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// The nearest airport within reach. A smaller airport counts as a little further
// away, so a big city's main airport wins over a regional strip nearby.
function nearest(lat: number, lon: number) {
  let best: Airport | undefined, bestScore = Infinity;
  for (const a of list()) {
    if (Math.abs(a.lat - lat) > 2) continue;
    const score = km(lat, lon, a.lat, a.lon) * (a.large ? 1 : 1.6);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best && bestScore < 150 ? METRO[best.code] ?? best.code : null;
}

export function GET(request: Request) {
  const h = request.headers;
  const lat = parseFloat(h.get("x-vercel-ip-latitude") ?? ""), lon = parseFloat(h.get("x-vercel-ip-longitude") ?? "");
  const code = Number.isFinite(lat) && Number.isFinite(lon) ? nearest(lat, lon) : null;
  return Response.json(
    { code, timeZone: h.get("x-vercel-ip-timezone") },
    { headers: { "cache-control": "private, no-store" } },
  );
}

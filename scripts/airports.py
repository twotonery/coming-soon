# Rebuilds src/app/api/where/airports.ts from OurAirports (public domain):
#   curl -sSfLO https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
#   python3 scripts/airports.py airports.csv
import csv, sys
rows = [(r["iata_code"], round(float(r["latitude_deg"]), 2), round(float(r["longitude_deg"]), 2), "L" if r["type"] == "large_airport" else "M")
        for r in csv.DictReader(open(sys.argv[1], encoding="utf-8"))
        if r["type"] in ("large_airport", "medium_airport") and r["scheduled_service"] == "yes" and len(r["iata_code"]) == 3]
s = ";".join(f"{c},{a},{o},{t}" for c, a, o, t in rows)
open("src/app/api/where/airports.ts", "w").write(
    "// Airports with scheduled flights (large and medium), from OurAirports (public domain):\n"
    "// IATA code, latitude, longitude, L(arge) or M(edium). Generated; see scripts/airports.py.\n"
    f'export const AIRPORTS = "{s}";\n')

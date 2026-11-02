#!/usr/bin/env python3
"""Price history log for the Cozaint storage cost calculator.

Writes history.csv: one row per price update, with every price the calculator uses,
in plain-English column names, so the team can look back for trends (opens in Excel).

  python3 hard-drive-data-app/update_history.py            add/refresh today's row from prices.json
  python3 hard-drive-data-app/update_history.py --rebuild  rebuild every row from the git history of prices.json

Run from the repository root. The monthly price update runs it after prices.json is saved.
Columns for individual systems and cloud providers are added automatically when a new one appears;
earlier rows are left blank for columns that did not exist yet.
"""
import csv, json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(HERE, "history.csv")
PRICES = os.path.join(HERE, "prices.json")


def g(d, *path):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return None
        d = d[p]
    return d


def r2(x):
    return None if x is None else round(float(x), 2)


def stepped_monthly(tiers, tb):
    left, frm, cost = tb, 0, 0.0
    for t in tiers:
        top = float("inf") if t.get("up_to_tb") is None else t["up_to_tb"]
        amt = min(left, top - frm)
        cost += amt * t["usd_per_tb_month"]
        left -= amt
        frm = top
        if left <= 0:
            break
    return cost


def flatten(p, date):
    """One row (ordered dict) of prices from one version of prices.json."""
    row = {"Date": date}
    hdd = p.get("hdd", {})
    row["Hard drive model"] = hdd.get("model_display") or hdd.get("label") or ""
    row["Hard drive price ($)"] = r2(hdd.get("price_usd"))
    row["Hard drive capacity (TB)"] = hdd.get("capacity_tb")
    row["Hard drive $ per TB"] = r2(hdd.get("usd_per_tb"))
    row["Hard drive market median $ per TB"] = r2(hdd.get("market_median_usd_per_tb"))
    survey = [x.get("mtbf_hours") for x in (g(hdd, "mtbf_survey", "drives") or []) if x.get("mtbf_hours")]
    row["Hard drive MTBF, industry average (hours)"] = round(sum(survey) / len(survey)) if survey else hdd.get("manufacturer_mtbf_hours")
    row["Hard drive real-world failure rate per year (Backblaze)"] = hdd.get("annual_failure_rate")
    row["Electricity $ per kWh"] = g(p, "electricity", "usd_per_kwh")
    row["Cooling factor (PUE)"] = g(p, "cooling", "pue")
    row["Disk enclosure (60-bay) $"] = r2(g(p, "disk_enclosure", "price_usd"))
    row["Server $"] = r2(g(p, "server", "price_usd"))

    systems = [s for s in (g(p, "surveillance_systems", "systems") or []) if s.get("price_usd") and s.get("raw_tb")]
    for s in systems:
        row[f"System: {s['name']} ($ per raw TB)"] = r2(s["price_usd"] / s["raw_tb"])
    if systems:
        row["Average complete hard drive system $ per raw TB"] = r2(sum(s["price_usd"] / s["raw_tb"] for s in systems) / len(systems))
        row["Number of systems in the average"] = len(systems)

    clouds = []
    if g(p, "cloud", "usd_per_tb_month"):
        clouds.append(("Wasabi", [{"up_to_tb": None, "usd_per_tb_month": p["cloud"]["usd_per_tb_month"]}]))
    for c in (g(p, "cloud_providers", "providers") or []):
        if c.get("tiers"):
            clouds.append((c.get("name", "cloud provider"), c["tiers"]))
    for name, tiers in clouds:
        row[f"Cloud: {name} ($ per TB per month, first price step)"] = r2(tiers[0]["usd_per_tb_month"])
    if clouds:
        row["Average cloud $ per TB per month (at 1 PB)"] = r2(sum(stepped_monthly(t, 1000) / 1000 for _, t in clouds) / len(clouds))
        row["Number of cloud providers in the average"] = len(clouds)

    for gen, label in (("12", "LTO-8"), ("18", "LTO-9"), ("30", "LTO-10")):
        row[f"Market {label} cartridge $"] = r2(g(p, "lto", gen, "price_usd"))
    for gen, label in (("12", "LTO-8"), ("18", "LTO-9"), ("30", "LTO-10")):
        row[f"Market {label} tape drive $"] = r2(g(p, "lto_drive", gen, "price_usd"))
    row["Market tape library base module $"] = r2(g(p, "tape_library", "base_module_price_usd"))
    row["Market tape library expansion module $"] = r2(g(p, "tape_library", "expansion_module_price_usd"))

    cz = g(p, "lto", "cozaint_cartridge_prices_usd") or {}
    for gen, label in (("12", "LTO-8"), ("18", "LTO-9"), ("30", "LTO-10 30 TB"), ("40", "LTO-10 40 TB")):
        if cz.get(gen):
            row[f"Cozaint {label} cartridge $ (MSRP)"] = r2(cz[gen])
    rn = g(p, "cozaint_services", "media_renewal_usd") or {}
    for gen, label in (("12", "LTO-8"), ("18", "LTO-9"), ("30", "LTO-10 30 TB"), ("40", "LTO-10 40 TB")):
        if rn.get(gen):
            row[f"Cozaint Media Lifecycle Renewal {label} $"] = r2(rn[gen])
    dr = g(p, "cozaint_hardware", "drives") or {}
    for gen, label in (("12", "LTO-8"), ("18", "LTO-9"), ("30", "LTO-10")):
        if g(dr, gen, "price_usd"):
            row[f"Cozaint {label} library drive $ (MSRP)"] = r2(dr[gen]["price_usd"])
    for lib in (g(p, "cozaint_hardware", "libraries") or []):
        row[f"Cozaint {lib.get('name', lib.get('sku'))} $ (MSRP)"] = r2(lib.get("price_usd"))
    if g(p, "cozaint_software", "marcia_base_usd"):
        row["Cozaint MARCIA base software $ (MSRP)"] = r2(p["cozaint_software"]["marcia_base_usd"])
    # no commas in column names, so the file reads cleanly everywhere
    return {k.replace(",", ""): v for k, v in row.items()}


def read_csv():
    if not os.path.exists(CSV):
        return [], []
    with open(CSV, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        rows = list(rd)
        cols = rd.fieldnames or []
    if "Date" not in cols:  # the old short format: start over
        return [], []
    return cols, rows


GROUPS = ["Date", "Hard drive", "Electricity", "Cooling", "Disk enclosure", "Server", "System:", "Average complete", "Number of systems",
          "Cloud:", "Average cloud", "Number of cloud", "Market", "Cozaint"]


def group_of(col):
    for i, p in enumerate(GROUPS):
        if col.startswith(p):
            return i
    return len(GROUPS)


def write_csv(cols, rows):
    cols[:] = sorted(cols, key=lambda c: (group_of(c), cols.index(c)))
    rows.sort(key=lambda r: r["Date"])
    with open(CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in cols})


def merge(cols, rows, new):
    for k in new:
        if k not in cols:
            cols.append(k)
    rows = [r for r in rows if r["Date"] != new["Date"]]
    rows.append(new)
    return cols, rows


def git_versions():
    root = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, cwd=HERE).stdout.strip()
    rel = os.path.relpath(PRICES, root)
    log = subprocess.run(["git", "log", "--reverse", "--format=%H %cs", "--", rel], capture_output=True, text=True, cwd=root).stdout.split("\n")
    for line in filter(None, log):
        sha, date = line.split()
        blob = subprocess.run(["git", "show", f"{sha}:{rel}"], capture_output=True, text=True, cwd=root).stdout
        try:
            yield date, json.loads(blob)
        except json.JSONDecodeError:
            continue


if __name__ == "__main__":
    if "--rebuild" in sys.argv:
        cols, rows = [], []
        for date, p in git_versions():  # later versions on the same day replace earlier ones
            cols, rows = merge(cols, rows, flatten(p, date))
    else:
        cols, rows = read_csv()
        p = json.load(open(PRICES, encoding="utf-8"))
        date = p.get("updated") or datetime.date.today().isoformat()
        cols, rows = merge(cols, rows, flatten(p, date))
    write_csv(cols, rows)
    print(f"history.csv: {len(rows)} rows, {len(cols)} columns")

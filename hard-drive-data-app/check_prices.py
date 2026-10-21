#!/usr/bin/env python3
"""Check a new prices.json before it goes live.

Usage:
    python3 check_prices.py NEW_prices.json [OLD_prices.json]

Exit code 0 = safe to publish.
Exit code 1 = a problem was found (missing field, bad number, or a price
              moved more than the allowed amount since last month).
              Do NOT publish; report the printed problems instead.
"""
import json
import sys

MAX_MONTHLY_CHANGE = 0.30  # a move bigger than 30% in one month is held for a human

# (path in the file, lowest believable value, highest believable value)
CHECKS = [
    (("hdd", "capacity_tb"), 4, 60),
    (("hdd", "price_usd"), 50, 3000),
    (("hdd", "usd_per_tb"), 5, 150),
    (("hdd", "watts"), 3, 20),
    (("hdd", "annual_failure_rate"), 0.002, 0.10),
    (("hdd", "service_life_years"), 3, 10),
    (("lto", "archival_life_years"), 15, 50),
    (("raid", "usable_fraction"), 0.5, 1.0),
    (("raid", "group_size"), 4, 30),
    (("disk_enclosure", "bays"), 12, 120),
    (("disk_enclosure", "price_usd"), 500, 40000),
    (("disk_enclosure", "watts"), 20, 1000),
    (("server", "price_usd"), 1500, 60000),
    (("server", "enclosures_per_server"), 1, 16),
    (("server", "watts"), 50, 2000),
    (("tape_library", "base_module_price_usd"), 2000, 100000),
    (("tape_library", "expansion_module_price_usd"), 1000, 60000),
    (("tape_library", "slots_per_module"), 10, 200),
    (("tape_library", "max_modules_per_library"), 1, 20),
    (("tape_library", "watts_per_library"), 20, 2000),
    (("cooling", "pue"), 1.0, 2.5),
    (("tape_system", "disk_tier_fraction"), 0.0, 0.5),
    (("lto", "12", "price_usd"), 20, 400),
    (("lto", "18", "price_usd"), 30, 500),
    (("lto", "30", "price_usd"), 60, 1000),
    (("lto_drive", "12", "price_usd"), 1000, 30000),
    (("lto_drive", "18", "price_usd"), 1000, 40000),
    (("lto_drive", "30", "price_usd"), 1000, 60000),
    (("cloud", "usd_per_tb_month"), 1, 50),
    (("electricity", "usd_per_kwh"), 0.03, 0.60),
]


def get(data, path):
    for key in path:
        if not isinstance(data, dict) or key not in data:
            return None
        data = data[key]
    return data


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    with open(sys.argv[1], encoding="utf-8") as f:
        new = json.load(f)
    old = None
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding="utf-8") as f:
            old = json.load(f)

    problems = []

    if new.get("schema_version") != 2:
        problems.append("schema_version must be 2")
    if not new.get("updated"):
        problems.append("missing 'updated' date")

    for path, low, high in CHECKS:
        name = ".".join(path)
        value = get(new, path)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            problems.append(f"{name}: missing or not a number ({value!r})")
            continue
        if not (low <= value <= high):
            problems.append(f"{name}: {value} is outside the believable range {low} to {high}")
        if old is not None:
            before = get(old, path)
            if isinstance(before, (int, float)) and before > 0:
                change = (value - before) / before
                if abs(change) > MAX_MONTHLY_CHANGE:
                    problems.append(
                        f"{name}: changed {change:+.0%} since last month ({before} -> {value}); "
                        "hold for a human to confirm"
                    )

    # usd_per_tb must agree with price / capacity
    cap, price, per_tb = (get(new, ("hdd", k)) for k in ("capacity_tb", "price_usd", "usd_per_tb"))
    if all(isinstance(v, (int, float)) for v in (cap, price, per_tb)) and cap > 0:
        if abs(price / cap - per_tb) > 0.05:
            problems.append(f"hdd.usd_per_tb is {per_tb} but price/capacity is {price / cap:.2f}")

    # every price section needs a source
    for section in ("hdd", "disk_enclosure", "server", "tape_library", "lto", "lto_drive", "cloud", "electricity", "cooling"):
        if not get(new, (section, "source_url")):
            problems.append(f"{section}: missing source_url")

    cozaint = get(new, ("lto", "cozaint_cartridge_price_usd"))
    if cozaint is not None and not (isinstance(cozaint, (int, float)) and cozaint > 0):
        problems.append("lto.cozaint_cartridge_price_usd must be null or a positive number")

    cmap = get(new, ("lto", "cozaint_cartridge_prices_usd"))
    if cmap is not None:
        if not isinstance(cmap, dict):
            problems.append("lto.cozaint_cartridge_prices_usd must be a list of prices by generation")
        else:
            for gen, val in cmap.items():
                if not (isinstance(val, (int, float)) and not isinstance(val, bool) and val > 0):
                    problems.append(f"lto.cozaint_cartridge_prices_usd.{gen} must be a positive number")
    if old is not None:
        for key in ("cozaint_cartridge_price_usd", "cozaint_cartridge_prices_usd"):
            if get(old, ("lto", key)) != get(new, ("lto", key)):
                problems.append(f"lto.{key} changed; only a person may change Cozaint prices")
        for sec in ("cozaint_software", "cozaint_hardware", "cozaint_services"):
            if get(old, (sec,)) != get(new, (sec,)):
                problems.append(f"{sec} changed; only a person may change Cozaint prices")

    systems = get(new, ("surveillance_systems", "systems"))
    if not isinstance(systems, list) or len(systems) < 3:
        problems.append("surveillance_systems.systems must list at least 3 complete systems")
    else:
        for i, x in enumerate(systems):
            ok = isinstance(x, dict) and all(isinstance(x.get(k), (int, float)) and not isinstance(x.get(k), bool) and x.get(k) > 0
                                            for k in ("price_usd", "raw_tb"))
            if not ok:
                problems.append(f"surveillance_systems.systems[{i}] needs a positive price_usd and raw_tb")
                continue
            per_tb = x["price_usd"] / x["raw_tb"]
            if not 30 <= per_tb <= 1000:
                problems.append(f"surveillance_systems.systems[{i}] ({x.get('name')}) is ${per_tb:.0f} per TB, outside $30-$1000")
            if not x.get("source_url"):
                problems.append(f"surveillance_systems.systems[{i}] ({x.get('name')}) has no source_url")
        if old is not None:
            def avg(lst):
                v = [y["price_usd"] / y["raw_tb"] for y in lst if isinstance(y, dict) and y.get("price_usd") and y.get("raw_tb")]
                return sum(v) / len(v) if v else None
            a_new, a_old = avg(systems), avg(get(old, ("surveillance_systems", "systems")) or [])
            if a_new and a_old and abs(a_new - a_old) / a_old > MAX_MONTHLY_CHANGE:
                problems.append(f"average complete system price moved from ${a_old:.0f} to ${a_new:.0f} per TB (more than 30%)")

    if problems:
        print("NOT SAFE TO PUBLISH:")
        for p in problems:
            print(" -", p)
        return 1
    print("OK: prices.json passed all checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

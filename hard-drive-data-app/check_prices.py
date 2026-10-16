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
    (("raid", "usable_fraction"), 0.5, 1.0),
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

    if new.get("schema_version") != 1:
        problems.append("schema_version must be 1")
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
    for section in ("hdd", "lto", "lto_drive", "cloud", "electricity"):
        if not get(new, (section, "source_url")):
            problems.append(f"{section}: missing source_url")

    cozaint = get(new, ("lto", "cozaint_cartridge_price_usd"))
    if cozaint is not None and not (isinstance(cozaint, (int, float)) and cozaint > 0):
        problems.append("lto.cozaint_cartridge_price_usd must be null or a positive number")

    if problems:
        print("NOT SAFE TO PUBLISH:")
        for p in problems:
            print(" -", p)
        return 1
    print("OK: prices.json passed all checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

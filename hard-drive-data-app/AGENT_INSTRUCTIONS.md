# Monthly price update: instructions for the agent

You are refreshing the storage prices that the Cozaint website cost calculator
(`assessment.html` + `tco.js`) reads from `hard-drive-data-app/prices.json`.
Run once a month. Work only inside the `cozaintcorp/cozaint-corporate-website`
repo, and only change files in the `hard-drive-data-app/` folder.

## 1. Collect current prices

Use web search and fetch public pages. Prefer the same sources as last month
(listed in `prices.json` under each `source_url`) so months stay comparable.
Record new, US-dollar prices before tax and shipping.

| Field | What to find | Rule |
|---|---|---|
| `hdd` | A current large enterprise hard drive (18 TB or bigger, new, e.g. Seagate Exos or WD Ultrastar) with a real listed price | Keep the same model as last month if it is still listed new; otherwise pick the closest current equivalent and say so in `label`. Set `usd_per_tb` = `price_usd / capacity_tb`, 2 decimals. Also update `market_median_usd_per_tb` if the tracker gives one. |
| `hdd.annual_failure_rate` | Backblaze's latest lifetime annualized failure rate (quarterly Drive Stats post) | As a fraction, e.g. 1.41% = `0.0141`. |
| `disk_enclosure` | New, empty 60-bay 4U disk enclosure (JBOD), e.g. Supermicro 946SE1C-R1K66JBOD or WD Ultrastar Data60 | Same model as last month if still listed new. Keep `bays` and `watts` unless the model changes. |
| `server` | Starting price of a new 2U rack server, e.g. Dell PowerEdge R760xs on dell.com | Same model as last month if still listed. |
| `tape_library` | HPE MSL6480 base module (80 slots, no drives) and expansion module prices | Keep `slots_per_module`, `max_modules_per_library`, `watts_per_library` unless HPE changes them. |
| `lto` (12, 18, 30) | LTO-8, LTO-9, LTO-10 (30 TB) cartridge price range | `price_usd` = midpoint of low and high, 2 decimals. Never change `cozaint_cartridge_price_usd`, `cozaint_cartridge_prices_usd` or `cozaint_price_source`; only a person sets Cozaint's prices, and the same goes for the whole `cozaint_software` section (MARCIA base software) the `cozaint_hardware` section (MARCIA libraries, drives, SAS parts) and the `cozaint_services` section (Media Lifecycle Renewal) (the safety check blocks any change to them). The market prices are still recorded every month for comparison. |
| `lto_drive` (12, 18, 30) | Tape drive price for each generation; for LTO-9, the HPE MSL LTO-9 SAS drive upgrade kit (R6Q75A) | Library drive kit price where listed, otherwise the midpoint of the drive price range, whole dollars. |
| `cooling.pue` | Latest Uptime Institute global average PUE | Changes about once a year; keep it otherwise. |
| `cloud` | Wasabi pay-as-you-go price per TB per month | From wasabi.com if readable, otherwise a reliable summary. |
| `electricity` | Latest US average commercial electricity price (EIA) | Dollars per kWh, 4 decimals. |
| `market_trend.summary` | One or two plain sentences on where drive and tape prices are heading | With source URLs. |

Set `checked` on each section to the date you actually saw the price. Set the
top-level `updated` to today's date and `updated_by` to "Claude monthly agent".
Do not change `schema_version`, `raid`, `tape_system`, or the `watts` fields
unless a datasheet for a new model gives a different figure. Never change
`tape_system.disk_tier_fraction`; only a person sets it.
Keep `hdd.service_life_years`, `hdd.manufacturer_mtbf_hours`, `hdd.manufacturer_afr`,
`lto.archival_life_years` and their notes and source links as they are, unless
the drive model changes (then take the new model's warranty years and MTBF
from its datasheet). When Backblaze publishes new drive stats, update
`hdd.annual_failure_rate` from their lifetime table total and refresh its note.

## Drive MTBF survey (`hdd.mtbf_survey.drives`)

The calculator's MTBF is the plain average of the manufacturers' published
MTBF ratings for current enterprise and surveillance drive lines from all
three hard drive makers (Seagate, Western Digital, Toshiba). Each month,
check each listed drive line's current datasheet; update `mtbf_hours` and
`checked` if the rating changed, and replace a discontinued line with its
successor from the same maker. Keep at least one enterprise and one
surveillance line per maker. Mention any change in the report.

## Cloud providers (`cloud` and `cloud_providers.providers`)

The website prices cloud storage as the AVERAGE of Wasabi (the `cloud`
section, as before) and the providers in `cloud_providers.providers`
(Amazon S3 Standard, Microsoft Azure Blob Hot LRS, Google Cloud Storage
Standard). Each month re-check every provider's standard (hot) storage
price, pay as you go, in its US East / primary US region, from the
provider's own pricing page or a pricing guide dated within the last 3
months. Record each volume step as `up_to_tb` (top of the step in TB;
null for the last step) and `usd_per_tb_month` (price per GB per month
x 1,000). Update `checked`, and mention any change in the report.

## Complete surveillance systems (`surveillance_systems.systems`)

The website compares Cozaint MARCIA with the AVERAGE price per TB of raw disk
across complete, ready-made video surveillance storage systems (recorders or
video servers sold with drives, e.g. BCDVideo, Hanwha Wisenet WAVE, Avigilon,
Milestone Husky, Genetec Streamvault). Each month:

- Re-check every listed system at its `source_url`. Update `price_usd` and
  `checked` when the listing shows a new price. If a listing is gone or shows
  no price, replace it with the same model from another US reseller, or drop it.
- Add any new complete system you find with a published US price and a stated
  raw capacity (TB); aim for 5 to 10 systems from at least 3 makers.
- Never add a do-it-yourself build, loose drives, an empty chassis or a bare
  disk shelf (JBOD); the comparison must be complete system vs. complete system.
- Each entry needs `name`, `raw_tb`, `price_usd`, `source_name`, `source_url`,
  `checked`. The safety check holds the update if the average moves more than 30%.
- Mention in the report which systems changed, were added or were dropped.

If a source cannot be reached, keep last month's value for that section,
leave its old `checked` date, and mention it in the report.

## 2. Check before publishing

Save the old file first, then run:

```
cp hard-drive-data-app/prices.json /tmp/prices_old.json
# ...write the new prices.json...
python3 hard-drive-data-app/check_prices.py hard-drive-data-app/prices.json /tmp/prices_old.json
```

- **"OK"**: continue to step 3.
- **"NOT SAFE TO PUBLISH"**: do not commit `prices.json`. Restore the old
  file. Report each problem and the prices you found so a person can confirm
  them. A price moving more than 30% in a month is held on purpose.

## 3. Save and publish

1. Add one row to `history.csv` with today's values (same column order).
2. Add a dated section at the top of `market-notes.md`: what changed in prices,
   and any new surveillance-storage products or competitor news worth knowing
   (tape archives, disk appliances, cloud video retention). Keep it short and
   paraphrased, with source links.
3. Commit only the files in `hard-drive-data-app/` with the message
   `Monthly price update YYYY-MM-DD` and push to `main`.

## 4. Report

Send the user a short plain-language summary: the main prices this month vs.
last month, what the calculator's default example now shows for hard drives vs.
tape, anything held for review, and any source that failed.

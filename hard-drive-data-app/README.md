# Hard drive data app

Keeps the cost comparison on the Cozaint storage calculator (`assessment.html`)
up to date with current hard drive, LTO tape, cloud and electricity prices.

## Files

| File | What it is |
|---|---|
| `prices.json` | The current prices. The calculator reads this file. Every number has a source link and a "checked" date. |
| `history.csv` | One row per month, for tracking price trends over time. |
| `market-notes.md` | Monthly notes on price trends and competitor products. |
| `check_prices.py` | Safety check run before each update. Blocks missing data, impossible numbers, and any price that moves more than 30% in a month. |
| `AGENT_INSTRUCTIONS.md` | Step-by-step instructions the monthly agent follows. |

## How the website gets the prices

`tco.js` first loads the copy on GitHub Pages:
`https://cozaintcorp.github.io/cozaint-corporate-website/hard-drive-data-app/prices.json`.
That way cozaint.com picks up each monthly update without the webmaster
uploading anything. If GitHub can't be reached, it uses the copy of
`prices.json` uploaded next to the page.

## What the comparison counts

The page shows LTO tape, hard drives and cloud left to right. Each total has
an asterisk that points to a "How these costs add up" box underneath, listing
every line as quantity × current price.

- **LTO tape (Cozaint two-tier system):** cartridges; HPE MSL6480 tape library
  sized to hold every cartridge (80-slot modules, up to 7 per library); the
  tape drives the calculator sizes; a disk tier holding 10% of the video for
  instant playback (as in Cozaint's storage white paper) with its drives,
  enclosures and replacement drives; one server; power and cooling. Stored
  cartridges use no power.
- **Hard drives only:** drives for the storage in RAID 6 (12-drive groups,
  rounded up to full groups); 60-bay enclosures; one server per 4 enclosures;
  replacement drives at Backblaze's failure rate; power and cooling.
- **Cloud:** Wasabi monthly storage fee for the years chosen.
- **Power and cooling:** equipment watts × cooling multiplier (data center
  PUE, industry average 1.54) × hours × US business electricity price.

Not counted on any option: racks, network switches, software licenses,
installation and support contracts; the cloud option's on-site recorder.

For smaller systems (at current prices, roughly under 1,000 TB over 5 years)
hard drives come out cheaper, because the tape library, tape drives and server
are a fixed starting cost of about $100,000. The page says
so when that happens.

## Cozaint's own cartridge price

To use Cozaint's price for Cozaint/Fujifilm LTO-9 cartridges instead of the
market price, set `lto.cozaint_cartridge_price_usd` in `prices.json` to the
price (for example `95.00`). The monthly agent never changes this field.

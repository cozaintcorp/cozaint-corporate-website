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

- **Hard drives:** enough drives for the storage needed in RAID 6 (12-drive
  groups), plus electricity for those drives over the years chosen.
- **LTO tape:** cartridges plus the tape drives the calculator already sizes.
  Stored cartridges use no power.
- **Cloud:** monthly storage fee for the years chosen.

Not counted (for now): disk servers and enclosures, the tape library chassis,
cooling, and cloud download fees.

## Cozaint's own cartridge price

To use Cozaint's price for Cozaint/Fujifilm LTO-9 cartridges instead of the
market price, set `lto.cozaint_cartridge_price_usd` in `prices.json` to the
price (for example `95.00`). The monthly agent never changes this field.

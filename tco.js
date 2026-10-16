// Cozaint storage cost comparison (hard drives vs. LTO tape vs. cloud)
// Prices come from hard-drive-data-app/prices.json, refreshed monthly.
// It tries the GitHub copy first (so monthly updates reach cozaint.com
// without a new upload), then the copy that sits next to this page.

(function () {
  var SOURCES = [
    'https://cozaintcorp.github.io/cozaint-corporate-website/hard-drive-data-app/prices.json',
    'hard-drive-data-app/prices.json'
  ];
  var HOURS_PER_YEAR = 24 * 365;

  var prices = null;
  var lastCalc = null;

  function money(n) {
    if (!isFinite(n)) return '—';
    return '$' + Math.round(n).toLocaleString();
  }

  function loadPrices(i) {
    if (i >= SOURCES.length) {
      showError();
      return;
    }
    fetch(SOURCES[i], { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || data.schema_version !== 1 || !data.hdd || !data.lto) throw new Error('bad data');
        prices = data;
        render();
      })
      .catch(function () {
        loadPrices(i + 1);
      });
  }

  function el(id) { return document.getElementById(id); }

  function showError() {
    var box = el('tcoBox');
    if (box) box.classList.add('tco-unavailable');
    var msg = el('tcoStatus');
    if (msg) msg.textContent = 'Current prices could not be loaded. Please try again later.';
  }

  function compute(calc, years) {
    var p = prices;
    var tb = calc.totalTb;
    var gen = String(calc.ltoCapacity);

    // Hard drives: RAID 6 overhead, drive cost, and power for the years chosen
    var rawTb = tb / p.raid.usable_fraction;
    var hddCount = Math.ceil(rawTb / p.hdd.capacity_tb);
    var hddMedia = hddCount * p.hdd.price_usd;
    var hddKwh = hddCount * p.hdd.watts * HOURS_PER_YEAR * years / 1000;
    var hddPower = hddKwh * p.electricity.usd_per_kwh;
    var hddTotal = hddMedia + hddPower;

    // LTO tape: cartridges plus tape drives (stored cartridges use no power)
    var cart = p.lto[gen] || p.lto['18'];
    var cartPrice = cart.price_usd;
    var usingCozaintPrice = false;
    if (gen === '18' && typeof p.lto.cozaint_cartridge_price_usd === 'number') {
      cartPrice = p.lto.cozaint_cartridge_price_usd;
      usingCozaintPrice = true;
    }
    var cartridges = Math.ceil(tb / calc.ltoCapacity);
    var tapeMedia = cartridges * cartPrice;
    var drive = (p.lto_drive && (p.lto_drive[gen] || p.lto_drive['18'])) || { price_usd: 0 };
    var tapeDrives = calc.tapeDrives * drive.price_usd;
    var tapeTotal = tapeMedia + tapeDrives;

    // Cloud: monthly storage fee for the years chosen
    var cloudTotal = tb * p.cloud.usd_per_tb_month * 12 * years;

    return {
      tb: tb, years: years,
      hddCount: hddCount, hddMedia: hddMedia, hddPower: hddPower, hddTotal: hddTotal,
      cartridges: cartridges, cartPrice: cartPrice, usingCozaintPrice: usingCozaintPrice,
      tapeMedia: tapeMedia, tapeDriveCount: calc.tapeDrives, tapeDrives: tapeDrives, tapeTotal: tapeTotal,
      cloudTotal: cloudTotal
    };
  }

  function render() {
    if (!prices || !lastCalc || !el('tcoBox')) return;
    var years = parseFloat(el('tcoYears').value) || 5;
    var r = compute(lastCalc, years);

    el('tcoHdd').textContent = money(r.hddTotal);
    el('tcoHddDetail').textContent = r.hddCount.toLocaleString() + ' drives ' + money(r.hddMedia) +
      ' + power ' + money(r.hddPower);
    el('tcoTape').textContent = money(r.tapeTotal);
    el('tcoTapeDetail').textContent = r.cartridges.toLocaleString() + ' cartridges ' + money(r.tapeMedia) +
      ' + ' + r.tapeDriveCount + ' tape drives ' + money(r.tapeDrives);
    el('tcoCloud').textContent = money(r.cloudTotal);
    el('tcoCloudDetail').textContent = r.tb.toLocaleString() + ' TB for ' + years + ' years';

    var saving = r.hddTotal - r.tapeTotal;
    var pct = r.hddTotal > 0 ? Math.round(saving / r.hddTotal * 100) : 0;
    el('tcoSavings').textContent = saving > 0
      ? 'LTO tape saves ' + money(saving) + ' (' + pct + '%) compared with hard drives.'
      : 'At this size, hard drives cost less than tape.';

    el('tcoStatus').textContent = 'Prices updated ' + prices.updated +
      (r.usingCozaintPrice ? ' (Cozaint cartridge price)' : ' (market prices)') +
      '. Not counted: disk servers and enclosures, the tape library chassis, cooling, and cloud download fees.';
  }

  document.addEventListener('cozaint:calc', function (e) {
    lastCalc = e.detail;
    render();
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (!el('tcoBox')) return;
    el('tcoYears').addEventListener('input', render);
    el('tcoYears').addEventListener('change', render);
    loadPrices(0);
  });
})();

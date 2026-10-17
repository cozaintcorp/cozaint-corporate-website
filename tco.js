// Cozaint storage cost comparison: LTO tape vs. hard drives vs. cloud
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
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function money2(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(n) { return Math.round(n).toLocaleString('en-US'); }
  function yrs(n) { return n + (n === 1 ? ' year' : ' years'); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  // A price file is used only if every number the comparison needs works out.
  function usable(data) {
    if (!data || data.schema_version !== 2) return false;
    var keep = prices;
    try {
      prices = data;
      var ok = true;
      [12, 18, 30].forEach(function (gen) {
        var r = compute({ totalTb: 500, ltoCapacity: gen, cartridges: 1, tapeDrives: 2 }, 5);
        [r.tape, r.hdd, r.cloud].forEach(function (part) {
          if (!(isFinite(part.total) && part.total > 0)) ok = false;
          part.lines.forEach(function (l) { if (!isFinite(l.amount) || /NaN|undefined/.test(l.detail)) ok = false; });
        });
      });
      return ok;
    } catch (e) {
      return false;
    } finally {
      prices = keep;
    }
  }

  function loadPrices(i) {
    if (i >= SOURCES.length) { showError(); return; }
    if (!window.fetch) { showError(); return; }
    // Give up on a slow source after 6 seconds and try the next one.
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
    fetch(SOURCES[i], ctrl ? { cache: 'no-cache', signal: ctrl.signal } : { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (!usable(data)) throw new Error('bad data');
        prices = data;
        render();
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        loadPrices(i + 1);
      });
  }

  function showError() {
    var box = el('tcoBox');
    if (box) box.classList.add('tco-unavailable');
    var msg = el('tcoStatus');
    if (msg) msg.textContent = 'Current prices could not be loaded. Please try again later.';
  }

  // A RAID 6 disk system holding `tb` terabytes: drives, enclosures, servers, power.
  function diskSystem(tb, years) {
    var p = prices;
    if (tb <= 0) return { tb: 0, rawTb: 0, drives: 0, enclosures: 0, servers: 0, replacements: 0, watts: 0 };
    var rawTb = tb / p.raid.usable_fraction;
    var g = p.raid.group_size;
    var drives = Math.ceil(Math.ceil(rawTb / p.hdd.capacity_tb) / g) * g;
    var enclosures = Math.ceil(drives / p.disk_enclosure.bays);
    var servers = Math.max(1, Math.ceil(enclosures / p.server.enclosures_per_server));
    var replacements = Math.ceil(drives * p.hdd.annual_failure_rate * years);
    var watts = drives * p.hdd.watts + enclosures * p.disk_enclosure.watts + servers * p.server.watts;
    return { tb: tb, rawTb: rawTb, drives: drives, enclosures: enclosures, servers: servers, replacements: replacements, watts: watts };
  }

  function powerCost(watts, years) {
    var p = prices;
    var kwh = watts * p.cooling.pue * HOURS_PER_YEAR * years / 1000;
    return { kw: watts * p.cooling.pue / 1000, kwh: kwh, cost: kwh * p.electricity.usd_per_kwh };
  }

  function line(label, detail, amount) { return { label: label, detail: detail, amount: amount }; }

  function sum(lines) {
    return lines.reduce(function (t, l) { return t + l.amount; }, 0);
  }

  function compute(calc, years) {
    var p = prices;
    var tb = calc.totalTb;
    var gen = String(calc.ltoCapacity);
    var drivePrice = p.hdd.price_usd;
    var hddName = p.hdd.capacity_tb + ' TB';

    // ---------- Hard drives only ----------
    var d = diskSystem(tb, years);
    var dPow = powerCost(d.watts, years);
    var hddLines = [
      line('Hard drives', num(d.drives) + ' × ' + money2(drivePrice) + ' (' + hddName + '). ' +
        num(tb) + ' TB in RAID 6 needs ' + num(d.rawTb) + ' TB of raw disk, in groups of ' + p.raid.group_size + ' drives',
        d.drives * drivePrice),
      line('Disk enclosures', num(d.enclosures) + ' × ' + money2(p.disk_enclosure.price_usd) + ' (' + p.disk_enclosure.bays + ' drives each)',
        d.enclosures * p.disk_enclosure.price_usd),
      line('Storage servers', num(d.servers) + ' × ' + money2(p.server.price_usd) + ' (one per ' + p.server.enclosures_per_server + ' enclosures)',
        d.servers * p.server.price_usd),
      line('Replacement drives', num(d.replacements) + ' × ' + money2(drivePrice) + ' (' + (p.hdd.annual_failure_rate * 100).toFixed(2) + '% of drives fail each year, for ' + yrs(years) + ')',
        d.replacements * drivePrice),
      line('Power and cooling', dPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ' at ' + (p.electricity.usd_per_kwh * 100).toFixed(2) + '¢ per kWh, cooling included',
        dPow.cost)
    ];

    // ---------- LTO tape (with a small disk tier) ----------
    var cart = p.lto[gen] || p.lto['18'];
    var cartPrice = cart.price_usd;
    var usingCozaintPrice = false;
    if (gen === '18' && typeof p.lto.cozaint_cartridge_price_usd === 'number') {
      cartPrice = p.lto.cozaint_cartridge_price_usd;
      usingCozaintPrice = true;
    }
    var cartridges = tb > 0 ? Math.ceil(tb / calc.ltoCapacity) : 0;
    var lib = p.tape_library;
    var modules = Math.max(1, Math.ceil(cartridges / lib.slots_per_module));
    var libraries = Math.ceil(modules / lib.max_modules_per_library);
    var libraryCost = libraries * lib.base_module_price_usd + (modules - libraries) * lib.expansion_module_price_usd;
    var tapeDrive = (p.lto_drive[gen] || p.lto_drive['18']).price_usd;
    var tierTb = tb * p.tape_system.disk_tier_fraction;
    var t = diskSystem(tierTb, years);
    t.servers = Math.max(1, t.servers);
    var tWatts = t.watts + (t.drives === 0 ? p.server.watts : 0) + libraries * lib.watts_per_library;
    var tPow = powerCost(tWatts, years);
    var tapeLines = [
      line('LTO tape cartridges', num(cartridges) + ' × ' + money2(cartPrice) + ' (' + calc.ltoCapacity + ' TB each' +
        (usingCozaintPrice ? ', Cozaint price' : '') + ')', cartridges * cartPrice),
      line('Tape library', num(libraries) + (libraries === 1 ? ' library, ' : ' libraries, ') + num(modules) + (modules === 1 ? ' module, ' : ' modules, ') +
        num(modules * lib.slots_per_module) + ' cartridge slots', libraryCost),
      line('Tape drives', num(calc.tapeDrives) + ' × ' + money2(tapeDrive), calc.tapeDrives * tapeDrive),
      line('Disk tier hard drives', num(t.drives) + ' × ' + money2(drivePrice) + ' (' + Math.round(p.tape_system.disk_tier_fraction * 100) +
        '% of the video, ' + num(tierTb) + ' TB, kept on disk for instant playback)', t.drives * drivePrice),
      line('Disk enclosures', num(t.enclosures) + ' × ' + money2(p.disk_enclosure.price_usd), t.enclosures * p.disk_enclosure.price_usd),
      line('Server (runs the Cozaint software and disk tier)', num(t.servers) + ' × ' + money2(p.server.price_usd), t.servers * p.server.price_usd),
      line('Replacement drives', num(t.replacements) + ' × ' + money2(drivePrice) + ' (disk tier only; tape cartridges are rated for decades)',
        t.replacements * drivePrice),
      line('Power and cooling', tPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ', cooling included. Cartridges on the shelf use no power',
        tPow.cost)
    ];

    // ---------- Cloud ----------
    var months = years * 12;
    var cloudLines = [
      line('Cloud storage', num(tb) + ' TB × ' + money2(p.cloud.usd_per_tb_month) + ' per TB per month × ' + months + ' months',
        tb * p.cloud.usd_per_tb_month * months)
    ];

    return {
      tb: tb, years: years, usingCozaintPrice: usingCozaintPrice,
      tape: { lines: tapeLines, total: sum(tapeLines) },
      hdd: { lines: hddLines, total: sum(hddLines) },
      cloud: { lines: cloudLines, total: sum(cloudLines) }
    };
  }

  function table(title, part) {
    var rows = part.lines.map(function (l) {
      return '<tr><td><strong>' + esc(l.label) + '</strong><span>' + esc(l.detail) + '</span></td><td>' + money(l.amount) + '</td></tr>';
    }).join('');
    return '<table class="tco-table"><caption>' + esc(title) + '</caption><tbody>' + rows +
      '<tr class="tco-total"><td>Total</td><td>' + money(part.total) + '</td></tr></tbody></table>';
  }

  function sourcesHtml() {
    var p = prices;
    var list = [
      ['Hard drives', p.hdd], ['Disk enclosures', p.disk_enclosure], ['Servers', p.server],
      ['Tape library', p.tape_library], ['Tape cartridges', p.lto], ['Tape drives', p.lto_drive],
      ['Cloud', p.cloud], ['Electricity', p.electricity], ['Cooling', p.cooling]
    ];
    return list.map(function (x) {
      return '<a href="' + esc(x[1].source_url) + '" target="_blank" rel="noopener">' + esc(x[0]) + '</a>';
    }).join(' · ');
  }

  function render() {
    if (!prices || !lastCalc || !el('tcoBox')) return;
    var years = Math.max(1, Math.min(20, parseFloat(el('tcoYears').value) || 5));
    if (!(lastCalc.totalTb > 0)) {
      el('tcoTape').textContent = '—';
      el('tcoHdd').textContent = '—';
      el('tcoCloud').textContent = '—';
      el('tcoSavings').textContent = 'Enter the number of cameras and retention days above to see costs.';
      el('tcoBreakdown').innerHTML = '';
      el('tcoStatus').textContent = '';
      return;
    }
    var r = compute(lastCalc, years);

    el('tcoTape').textContent = money(r.tape.total);
    el('tcoHdd').textContent = money(r.hdd.total);
    el('tcoCloud').textContent = money(r.cloud.total);

    var saving = r.hdd.total - r.tape.total;
    var pct = r.hdd.total > 0 ? Math.round(saving / r.hdd.total * 100) : 0;
    el('tcoSavings').textContent = saving > 0
      ? 'LTO tape saves ' + money(saving) + ' (' + pct + '%) compared with hard drives over ' + yrs(years) + '.'
      : 'At this size, hard drives cost less than tape.';

    el('tcoBreakdown').innerHTML =
      '<p class="tco-breakdown-title">* How these costs add up</p>' +
      table('LTO tape (Cozaint two-tier system)', r.tape) +
      table('Hard drives only', r.hdd) +
      table('Cloud storage', r.cloud) +
      '<p class="tco-notes">Prices updated ' + esc(prices.updated) +
      (r.usingCozaintPrice ? ' (Cozaint cartridge price)' : ' (market prices)') +
      '. Cooling adds ' + Math.round((prices.cooling.pue - 1) * 100) + '% to equipment power (industry average). ' +
      'Not counted on any option: racks, network switches, software licenses, installation and support contracts. ' +
      'Cloud also needs an on-site recorder, not counted. Sources: ' + sourcesHtml() + '.</p>';

    el('tcoStatus').textContent = '';
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

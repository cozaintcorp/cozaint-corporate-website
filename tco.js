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
    var r = Math.round(n);
    return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US');
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
    if (tb <= 0) return { tb: 0, rawTb: 0, drives: 0, enclosures: 0, servers: 0, replacements: 0, refreshes: 0, refreshDrives: 0, watts: 0 };
    var rawTb = tb / p.raid.usable_fraction;
    var g = p.raid.group_size;
    var drives = Math.ceil(Math.ceil(rawTb / p.hdd.capacity_tb) / g) * g;
    var enclosures = Math.ceil(drives / p.disk_enclosure.bays);
    var servers = Math.max(1, Math.ceil(enclosures / p.server.enclosures_per_server));
    // Random failures during service: annualized failure rate x drives x years.
    var replacements = Math.ceil(drives * p.hdd.annual_failure_rate * years);
    // Wear-out: every drive is replaced when it reaches its service life, if the
    // system keeps running past that point (e.g. life 5: replaced at years 5, 10, 15).
    var refreshes = Math.max(0, Math.ceil(years / serviceLife()) - 1);
    var watts = drives * p.hdd.watts + enclosures * p.disk_enclosure.watts + servers * p.server.watts;
    return { tb: tb, rawTb: rawTb, drives: drives, enclosures: enclosures, servers: servers, replacements: replacements,
      refreshes: refreshes, refreshDrives: drives * refreshes, watts: watts };
  }

  function tapeLife() {
    var l = prices.lto && prices.lto.archival_life_years;
    return typeof l === 'number' && l >= 1 ? l : 30;
  }

  function serviceLife() {
    var l = prices.hdd.service_life_years;
    return typeof l === 'number' && l >= 1 ? l : 5;
  }

  // "at the end of year 5" / "at years 5 and 10" / "at years 5, 10 and 15"
  function refreshYears(n) {
    var life = serviceLife(), list = [];
    for (var i = 1; i <= n; i++) list.push(i * life);
    if (list.length === 1) return 'at the end of year ' + list[0];
    return 'at years ' + list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function wearOutLine(sys, drivePrice, years) {
    var life = serviceLife();
    var detail = sys.refreshes > 0
      ? num(sys.drives) + ' drives × ' + sys.refreshes + (sys.refreshes === 1 ? ' replacement' : ' replacements') + ' × ' + money2(drivePrice) +
        '. Every drive reaches its ' + life + '-year rated life and is replaced ' + refreshYears(sys.refreshes)
      : 'None within ' + yrs(years) + '. Drives are rated for ' + life + ' years of 24/7 use; keep the video longer and every drive must be replaced';
    return line('Replacement drives: worn out **', detail, sys.refreshDrives * drivePrice);
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

  // Tape reuse: once video on a cartridge is older than the retention period,
  // the cartridge is reformatted (Cozaint charge) and reused instead of buying a new one.
  function reformatPrice() {
    var s = prices.cozaint_services;
    return s && typeof s.tape_reformat_usd === 'number' && s.tape_reformat_usd > 0 ? s.tape_reformat_usd : 0;
  }
  function reformatIsExample() {
    var s = prices.cozaint_services;
    return !!(s && s.tape_reformat_is_example);
  }
  function reformatCount(cartridges, retentionDays, years) {
    var days = years * 365;
    if (!(retentionDays > 0) || days <= retentionDays) return 0;
    return Math.ceil(cartridges * (days - retentionDays) / retentionDays);
  }
  // Volume discount on Cozaint cartridges: the highest tier reached applies to every cartridge.
  function discountTier(cartridges) {
    var s = prices.cozaint_services, best = null;
    if (!s || !Array.isArray(s.volume_discounts)) return null;
    s.volume_discounts.forEach(function (t) {
      if (t && t.min_cartridges > 0 && t.percent_off > 0 && t.percent_off < 100 && cartridges >= t.min_cartridges &&
          (!best || t.min_cartridges > best.min_cartridges)) best = t;
    });
    return best;
  }
  function discountLine(cartridges, cartPrice) {
    var s = prices.cozaint_services;
    if (!s || !Array.isArray(s.volume_discounts) || !s.volume_discounts.length) return null;
    var ex = s.volume_discounts_is_example ? ', example discount' : '';
    var t = discountTier(cartridges);
    if (!t) {
      var first = s.volume_discounts.slice().sort(function (a, b) { return a.min_cartridges - b.min_cartridges; })[0];
      return line('Volume discount on cartridges ***', 'None. ' + num(cartridges) + ' cartridges is below the first discount level (' +
        first.percent_off + '% off at ' + num(first.min_cartridges) + ' or more' + ex + ')', 0);
    }
    return line('Volume discount on cartridges ***', t.percent_off + '% off ' + num(cartridges) + ' cartridges (' + num(t.min_cartridges) +
      ' or more qualify' + ex + ')', -Math.round(cartridges * cartPrice * t.percent_off) / 100);
  }

  function reformatLine(cartridges, retentionDays, years) {
    var price = reformatPrice();
    if (!price || !(retentionDays > 0)) return null;
    var n = reformatCount(cartridges, retentionDays, years);
    var each = money2(price) + (reformatIsExample() ? ' (example price)' : ' (Cozaint price)');
    var detail;
    if (n > 0) {
      var times = (years * 365 - retentionDays) / retentionDays;
      detail = num(n) + ' reformats × ' + each + '. The ' + num(cartridges) + ' cartridges fill up after ' + num(retentionDays) +
        ' days; after that the oldest are reformatted and reused, about ' + (Math.round(times * 10) / 10) +
        (Math.round(times * 10) / 10 === 1 ? ' time' : ' times') + ' each over ' + yrs(years);
    } else {
      detail = 'None. Video is kept ' + num(retentionDays) + ' days, so no cartridge needs reusing within ' + yrs(years) +
        '. When it does, reformatting is ' + money2(price) + ' per cartridge' + (reformatIsExample() ? ' (example price)' : '');
    }
    return line('Tape reformatting for reuse ***', detail, n * price);
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
      line('Replacement drives: failures **', num(d.replacements) + ' × ' + money2(drivePrice) + ' (' + (p.hdd.annual_failure_rate * 100).toFixed(2) + '% of drives fail each year, for ' + yrs(years) + ')',
        d.replacements * drivePrice),
      wearOutLine(d, drivePrice, years),
      line('Power and cooling', dPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ' at ' + (p.electricity.usd_per_kwh * 100).toFixed(2) + '¢ per kWh, cooling included',
        dPow.cost)
    ];

    // ---------- LTO tape (with a small disk tier) ----------
    var cart = p.lto[gen] || p.lto['18'];
    var cartPrice = cart.price_usd;
    var usingCozaintPrice = false;
    var cozaintPrices = p.lto.cozaint_cartridge_prices_usd;
    if (cozaintPrices && typeof cozaintPrices[gen] === 'number' && cozaintPrices[gen] > 0) {
      cartPrice = cozaintPrices[gen];
      usingCozaintPrice = true;
    } else if (gen === '18' && typeof p.lto.cozaint_cartridge_price_usd === 'number') {
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
      line(usingCozaintPrice ? 'Cozaint Certified LTO tape cartridges' : 'LTO tape cartridges', num(cartridges) + ' × ' + money2(cartPrice) + ' (' + calc.ltoCapacity + ' TB each' +
        (usingCozaintPrice ? ', Cozaint list price' : '') + ')', cartridges * cartPrice),
      usingCozaintPrice ? discountLine(cartridges, cartPrice) : null,
      reformatLine(cartridges, calc.retentionDays, years),
      line('Tape library', num(libraries) + (libraries === 1 ? ' library, ' : ' libraries, ') + num(modules) + (modules === 1 ? ' module, ' : ' modules, ') +
        num(modules * lib.slots_per_module) + ' cartridge slots', libraryCost),
      line('Tape drives', num(calc.tapeDrives) + ' × ' + money2(tapeDrive), calc.tapeDrives * tapeDrive),
      line('Disk tier hard drives', num(t.drives) + ' × ' + money2(drivePrice) + ' (' + Math.round(p.tape_system.disk_tier_fraction * 100) +
        '% of the video, ' + num(tierTb) + ' TB, kept on disk for instant playback)', t.drives * drivePrice),
      line('Disk enclosures', num(t.enclosures) + ' × ' + money2(p.disk_enclosure.price_usd), t.enclosures * p.disk_enclosure.price_usd),
      // MARCIA base software at Cozaint list price, when the price file has it
      p.cozaint_software && p.cozaint_software.marcia_base_usd > 0 ?
        line('MARCIA base software', (p.cozaint_software.quantity || 1) + ' × ' + money2(p.cozaint_software.marcia_base_usd) + ' (Cozaint list price)',
          (p.cozaint_software.quantity || 1) * p.cozaint_software.marcia_base_usd) : null,
      line('Server (runs the Cozaint software and disk tier)', num(t.servers) + ' × ' + money2(p.server.price_usd), t.servers * p.server.price_usd),
      line('Replacement drives: failures **', num(t.replacements) + ' × ' + money2(drivePrice) + ' (disk tier only. Tape cartridges do not spin, so they do not wear out this way)',
        t.replacements * drivePrice),
      t.drives > 0 ? wearOutLine(t, drivePrice, years) : null,
      line('Replacement cartridges **', 'None. LTO cartridges are rated for ' + tapeLife() + ' years in archive, far longer than this ' + years + '-year period', 0),
      line('Power and cooling', tPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ', cooling included. Cartridges on the shelf use no power',
        tPow.cost)
    ];

    tapeLines = tapeLines.filter(function (l) { return l; });

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

  function volumeNoteHtml() {
    var s = prices.cozaint_services;
    if (!s || !Array.isArray(s.volume_discounts) || !s.volume_discounts.length) return '';
    var tiers = s.volume_discounts.slice().sort(function (a, b) { return a.min_cartridges - b.min_cartridges; })
      .map(function (t) { return t.percent_off + '% off at ' + num(t.min_cartridges) + ' or more'; });
    return '<p><strong>Volume pricing.</strong> Larger cartridge orders get a discount on the Cozaint list price: ' + tiers.join(', ') +
      (s.volume_discounts_is_example ? ' (example levels, to be confirmed)' : '') + '. The highest level reached applies to every cartridge in the order.</p>';
  }

  // The *** note: how tape reuse and the reformatting charge are counted.
  function reuseNote(r) {
    var price = reformatPrice();
    if (!price || !(lastCalc && lastCalc.retentionDays > 0)) return '';
    return '<div class="tco-footnote"><p><strong>*** Cozaint tape pricing: reuse and volume.</strong> The calculator buys enough cartridges to hold the ' +
      'retention period (' + num(lastCalc.retentionDays) + ' days). When video on a cartridge is older than that, the cartridge ' +
      'is reformatted and reused instead of buying a new one. Cozaint charges ' + money2(price) + ' per cartridge to reformat' +
      (reformatIsExample() ? ' (example price, to be confirmed)' : '') + '.</p>' +
      '<p>Reformats = cartridges × (days the system runs − retention days) ÷ retention days. Short retention means more reuse: ' +
      'with 1 year of retention over 5 years, each cartridge is reformatted about 4 times. With retention as long as the whole period, none are.</p>' +
      volumeNoteHtml() +
      '<p>A customer who would rather keep every full tape can buy new cartridges instead of reformatting. Hard drives overwrite old video at no charge, ' +
      'so the reformatting charge appears on the tape side only.</p></div>';
  }

  // The ** note: where the drive failure and wear-out figures come from.
  function failureNote() {
    var h = prices.hdd;
    var afr = (h.annual_failure_rate * 100).toFixed(2) + '%';
    var link = function (url, text) {
      return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + '</a>' : esc(text);
    };
    return '<div class="tco-footnote"><p><strong>** How drive failures are counted.</strong> Hard drives spin 24 hours a day and wear out; ' +
      'tape cartridges sit still on a shelf until needed. The calculator counts two kinds of drive replacement:</p>' +
      '<p><strong>1. Failures during service.</strong> Drives × annualized failure rate × years. The rate comes from the industry-standard formula ' +
      '<span class="tco-formula">failure rate = failures ÷ (drive-days ÷ 365) × 100</span>, measured by ' +
      link(h.annual_failure_rate_source_url, 'Backblaze') + ' on about 350,000 drives running around the clock: ' + afr + ' a year.' +
      (h.manufacturer_afr ? ' Manufacturers quote a lower lab figure (' + (h.manufacturer_afr * 100).toFixed(2) +
        '% from a ' + (h.manufacturer_mtbf_hours / 1e6) + ' million hour MTBF rating); the calculator uses the real-world rate.' : '') + '</p>' +
      '<p><strong>2. Worn-out drives.</strong> Enterprise drives are rated and warrantied for ' + serviceLife() + ' years of 24/7 use (' +
      link(h.service_life_source_url, 'Seagate Exos X20') + '). Video kept longer than that needs every drive replaced, which the calculator adds for each ' +
      serviceLife() + '-year period. LTO cartridges are designed for a ' + tapeLife() + '-year archival life (' +
      link(prices.lto.archival_life_source_url, 'LTO media data sheet') + '), so the video on tape needs no replacement media.</p></div>';
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


  // ---------- Chart in the left column ----------
  var CATS = [
    { key: 'media', name: 'Storage media' },
    { key: 'hardware', name: 'Equipment' },
    { key: 'software', name: 'Software' },
    { key: 'power', name: 'Power and cooling' }
  ];
  function catOf(label) {
    if (/power/i.test(label)) return 'power';
    if (/^MARCIA base software/.test(label)) return 'software';
    if (/cartridges|hard drives|replacement drives|reformatting|discount/i.test(label)) return 'media';
    return 'hardware';
  }
  function grouped(part) {
    var g = {};
    CATS.forEach(function (c) { g[c.key] = { total: 0, items: [] }; });
    part.lines.forEach(function (l) {
      var c = catOf(l.label);
      g[c].total += l.amount;
      if (l.amount > 0) g[c].items.push(l);
    });
    return g;
  }
  function compact(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('en-US') + 'K';
    return money(n);
  }
  var chartBuilt = false;
  var chartData = {};
  function buildChart() {
    var bars = el('tcoBars');
    [['tape', 'LTO tape'], ['hdd', 'Hard drives']].forEach(function (sys) {
      var row = document.createElement('div');
      row.className = 'tco-bar-row';
      var name = document.createElement('span');
      name.className = 'tco-bar-name';
      name.textContent = sys[1];
      var track = document.createElement('div');
      track.className = 'tco-track';
      CATS.forEach(function (c) {
        var seg = document.createElement('span');
        seg.className = 'tco-seg';
        seg.dataset.cat = c.key;
        seg.dataset.sys = sys[0];
        seg.tabIndex = 0;
        seg.style.width = '0%';
        seg.addEventListener('pointerenter', showTip);
        seg.addEventListener('pointerleave', hideTip);
        seg.addEventListener('focus', showTip);
        seg.addEventListener('blur', hideTip);
        track.appendChild(seg);
      });
      var total = document.createElement('span');
      total.className = 'tco-bar-total';
      total.id = 'tcoBarTotal-' + sys[0];
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(total);
      bars.appendChild(row);
    });
    var legend = el('tcoLegend');
    CATS.forEach(function (c) {
      var li = document.createElement('li');
      var sw = document.createElement('i');
      sw.style.background = 'var(--tco-' + c.key + ')';
      li.appendChild(sw);
      li.appendChild(document.createTextNode(c.name));
      legend.appendChild(li);
    });
    chartBuilt = true;
  }
  function showTip(e) {
    var seg = e.currentTarget, tip = el('tcoTip'), box = el('tcoChart');
    var d = chartData[seg.dataset.sys];
    if (!d) return;
    var g = d.groups[seg.dataset.cat];
    var cat = CATS.filter(function (c) { return c.key === seg.dataset.cat; })[0];
    tip.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = money(g.total);
    var sub = document.createElement('span');
    sub.textContent = cat.name + ' · ' + d.name + ' (' + Math.round(g.total / d.total * 100) + '% of ' + money(d.total) + ')';
    tip.appendChild(strong);
    tip.appendChild(sub);
    if (g.items.length > 1) {
      var ul = document.createElement('ul');
      g.items.forEach(function (l) {
        var li = document.createElement('li');
        var a = document.createElement('span'); a.textContent = l.label;
        var b = document.createElement('span'); b.textContent = money(l.amount);
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
      tip.appendChild(ul);
    }
    tip.hidden = false;
    var sr = seg.getBoundingClientRect(), br = box.getBoundingClientRect();
    var left = sr.left - br.left + sr.width / 2 - tip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, br.width - tip.offsetWidth - 8));
    tip.style.left = left + 'px';
    tip.style.top = (sr.top - br.top - tip.offsetHeight - 10) + 'px';
  }
  function hideTip() { el('tcoTip').hidden = true; }

  function renderChart(r) {
    var box = el('tcoChart');
    if (!box) return;
    if (!r) { box.hidden = true; return; }
    if (!chartBuilt) buildChart();
    box.hidden = false;
    chartData = {
      tape: { name: 'LTO tape', total: r.tape.total, groups: grouped(r.tape) },
      hdd: { name: 'Hard drives', total: r.hdd.total, groups: grouped(r.hdd) }
    };
    var max = Math.max(r.tape.total, r.hdd.total);
    ['tape', 'hdd'].forEach(function (sys) {
      var d = chartData[sys];
      var segs = el('tcoBars').querySelectorAll('.tco-seg[data-sys="' + sys + '"]');
      Array.prototype.forEach.call(segs, function (seg) {
        var g = d.groups[seg.dataset.cat];
        var pct = max > 0 ? g.total / max * 100 : 0;
        seg.style.width = (g.total > 0 ? Math.max(pct, 0.6) : 0) + '%';
        seg.classList.toggle('is-zero', !(g.total > 0));
        seg.setAttribute('aria-label', d.name + ', ' + CATS.filter(function (c) { return c.key === seg.dataset.cat; })[0].name + ': ' + money(g.total));
        if (!(g.total > 0)) seg.tabIndex = -1; else seg.tabIndex = 0;
      });
      el('tcoBarTotal-' + sys).textContent = money(d.total);
    });
    var saving = r.hdd.total - r.tape.total;
    var pct = r.hdd.total > 0 ? Math.round(saving / r.hdd.total * 100) : 0;
    var sub = el('tcoChartSub');
    sub.textContent = '';
    if (saving > 0) {
      el('tcoChartHero').textContent = money(saving);
      sub.appendChild(document.createTextNode('saved with LTO tape over ' + yrs(r.years) + ', '));
      var s1 = document.createElement('strong'); s1.textContent = pct + '% less';
      sub.appendChild(s1);
      sub.appendChild(document.createTextNode(' than hard drives, for ' + num(r.tb) + ' TB of video.'));
    } else {
      el('tcoChartHero').textContent = money(-saving);
      sub.appendChild(document.createTextNode('less with hard drives over ' + yrs(r.years) + ' at this size (' + num(r.tb) + ' TB). Tape pulls ahead as storage grows.'));
    }
    var note = el('tcoCloudNote');
    note.textContent = '';
    var times = r.tape.total > 0 ? r.cloud.total / r.tape.total : 0;
    note.appendChild(document.createTextNode('Cloud storage for the same video: '));
    var s2 = document.createElement('strong'); s2.textContent = money(r.cloud.total);
    note.appendChild(s2);
    note.appendChild(document.createTextNode(times >= 1.1
      ? ', about ' + times.toFixed(1) + ' times the LTO tape system (too large to draw on this scale).'
      : '.'));
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
      renderChart(null);
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
      failureNote() +
      reuseNote(r) +
      '<p class="tco-notes">Prices updated ' + esc(prices.updated) +
      (r.usingCozaintPrice ? ' (tape cartridges at Cozaint list price; everything else at market prices)' : ' (market prices)') +
      '. Cooling adds ' + Math.round((prices.cooling.pue - 1) * 100) + '% to equipment power (industry average). ' +
      'Not counted on any option: racks, network switches, video management (VMS) licenses, installation and support contracts. ' +
      'Cloud also needs an on-site recorder, not counted. Sources: ' + sourcesHtml() + '.</p>';

    el('tcoStatus').textContent = '';
    renderChart(r);
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

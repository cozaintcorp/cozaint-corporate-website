// Cozaint storage cost comparison: Cozaint MARCIA (LTO tape) vs. the average complete hard drive surveillance system vs. cloud
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
    if (!data || data.schema_version !== 2 || !data.cozaint_hardware || !data.surveillance_systems) return false;
    var keep = prices;
    try {
      prices = data;
      var ok = true;
      [12, 18, 30].forEach(function (gen) {
        var r = compute({ totalTb: 500, ltoCapacity: gen, cartridges: 1, tapeDrives: 2, retentionDays: 365 }, 5);
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

  function link(url, text) {
    return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + '</a>' : esc(text);
  }

  // ---------- Cozaint prices (MSRP from the MARCIA price list) ----------
  function cozCartridgePrice(gen) {
    var m = prices.lto.cozaint_cartridge_prices_usd;
    if (m && m[gen] > 0) return m[gen];
    return (prices.lto[gen] || prices.lto['18']).price_usd;
  }
  function renewalPrice(gen) {
    var s = prices.cozaint_services;
    return s && s.media_renewal_usd && s.media_renewal_usd[gen] > 0 ? s.media_renewal_usd[gen] : 0;
  }
  // Cheapest Cozaint library set-up with enough slots for this tape generation.
  function cozLibrary(slots, gen) {
    var best = null;
    (prices.cozaint_hardware.libraries || []).forEach(function (lib) {
      if (lib.lto_generations && lib.lto_generations.indexOf(gen) < 0) return;
      var exp = 0;
      if (slots > lib.slots) {
        if (!lib.expansion) return;
        exp = Math.ceil((slots - lib.slots) / lib.expansion.slots);
      }
      var cost = lib.price_usd + exp * (lib.expansion ? lib.expansion.price_usd : 0);
      if (!best || cost < best.cost) best = { lib: lib, exp: exp, cost: cost, slots: lib.slots + exp * (lib.expansion ? lib.expansion.slots : 0) };
    });
    return best;
  }
  function cozDrive(gen) {
    var d = prices.cozaint_hardware.drives;
    return d[gen] || d['18'];
  }
  function renewalCount(cartridges, retentionDays, years) {
    var days = years * 365;
    if (!(retentionDays > 0) || days <= retentionDays) return 0;
    return Math.ceil(cartridges * (days - retentionDays) / retentionDays);
  }

  // ---------- Average complete video surveillance storage system ----------
  function systemsList() {
    var s = prices.surveillance_systems;
    return (s && Array.isArray(s.systems) ? s.systems : []).filter(function (x) { return x && x.price_usd > 0 && x.raw_tb > 0; });
  }
  function avgPerRawTb() {
    var list = systemsList();
    if (!list.length) return NaN;
    return list.reduce(function (t, x) { return t + x.price_usd / x.raw_tb; }, 0) / list.length;
  }

  function compute(calc, years) {
    var p = prices;
    var tb = calc.totalTb;
    var gen = String(calc.ltoCapacity);
    var drivePrice = p.hdd.price_usd;

    // ---------- Average complete hard drive surveillance system ----------
    var d = diskSystem(tb, years);
    var dPow = powerCost(d.watts, years);
    var avg = avgPerRawTb();
    var nSys = systemsList().length;
    var hddLines = [
      line('Complete surveillance storage system ****', num(tb) + ' TB of video needs ' + num(d.rawTb) + ' TB of raw disk (RAID 6) × ' + money2(avg) +
        ' per TB, the average price of ' + nSys + ' complete video surveillance storage systems', d.rawTb * avg),
      line('Replacement drives: failures **', 'Included: assumed covered by the system warranty', 0),
      wearOutLine(d, drivePrice, years),
      line('Power and cooling', 'About ' + dPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ' at ' + (p.electricity.usd_per_kwh * 100).toFixed(2) + '¢ per kWh, cooling included',
        dPow.cost)
    ];

    // ---------- Cozaint MARCIA (LTO tape with a 10% disk tier) ----------
    var cartPrice = cozCartridgePrice(gen);
    var cartridges = tb > 0 ? Math.ceil(tb / calc.ltoCapacity) : 0;
    var lib = cozLibrary(Math.max(1, cartridges), gen);
    var drv = cozDrive(gen);
    var nDrives = calc.tapeDrives;
    var hw = p.cozaint_hardware;
    var hbas = Math.max(1, Math.ceil(nDrives / (hw.sas_hba.ports || 8)));
    var renewals = renewalCount(cartridges, calc.retentionDays, years);
    var renew = renewalPrice(gen);
    var tierPct = Math.round(p.tape_system.disk_tier_fraction * 100);
    var tierTb = tb * p.tape_system.disk_tier_fraction;
    var t = diskSystem(tierTb, years);
    t.servers = Math.max(1, t.servers);
    var tWatts = t.watts + (t.drives === 0 ? p.server.watts : 0) + p.tape_library.watts_per_library;
    var tPow = powerCost(tWatts, years);
    var marcia = p.cozaint_software && p.cozaint_software.marcia_base_usd > 0 ? p.cozaint_software.marcia_base_usd : 0;
    var renewDetail;
    if (renewals > 0) {
      var times = Math.round((years * 365 - calc.retentionDays) / calc.retentionDays * 10) / 10;
      renewDetail = num(renewals) + ' renewals × ' + money2(renew) + '. The ' + num(cartridges) + ' cartridges fill up after ' + num(calc.retentionDays) +
        ' days; after that each is erased and reused about ' + times + (times === 1 ? ' time' : ' times') + ' over ' + yrs(years);
    } else {
      renewDetail = 'None. Video is kept ' + num(calc.retentionDays) + ' days, so no cartridge is reused within ' + yrs(years) + ' (' + money2(renew) + ' per cartridge when it is)';
    }
    var tapeLines = [
      line('Cozaint Certified LTO cartridges ***', num(cartridges) + ' × ' + money2(cartPrice) + ' (' + calc.ltoCapacity + ' TB each)', cartridges * cartPrice),
      renew > 0 ? line('MARCIA Media Lifecycle Renewal ***', renewDetail, renewals * renew) : null,
      line('MARCIA LTO library ***', lib.lib.name + ' (' + lib.lib.sku + ')' + (lib.exp ? ' + ' + lib.exp + ' × ' + lib.lib.expansion.name + (lib.exp > 1 ? 's' : '') + ' (' + lib.lib.expansion.sku + ')' : '') +
        ', ' + num(lib.slots) + ' cartridge slots', lib.cost),
      line('LTO library drives ***', num(nDrives) + ' × ' + money2(drv.price_usd) + ' (' + drv.name + ', ' + drv.sku + ')', nDrives * drv.price_usd),
      line('SAS connectivity ***', hbas + ' × ' + money2(hw.sas_hba.price_usd) + ' adapter + ' + num(nDrives) + ' × ' + money2(hw.sas_cable.price_usd) + ' cables',
        hbas * hw.sas_hba.price_usd + nDrives * hw.sas_cable.price_usd),
      marcia ? line('MARCIA base software ***', '1 × ' + money2(marcia), marcia) : null,
      line(tierPct + '% disk tier: hard drives', num(t.drives) + ' × ' + money2(drivePrice) + ' (' + num(tierTb) + ' TB, ' + tierPct +
        '% of the video, kept on disk for instant playback; market price)', t.drives * drivePrice),
      line(tierPct + '% disk tier: enclosure', num(t.enclosures) + ' × ' + money2(p.disk_enclosure.price_usd) + ' (market price)', t.enclosures * p.disk_enclosure.price_usd),
      line(tierPct + '% disk tier: server', num(t.servers) + ' × ' + money2(p.server.price_usd) + ' (runs MARCIA and the disk tier; market price)', t.servers * p.server.price_usd),
      line('Replacement drives: failures **', num(t.replacements) + ' × ' + money2(drivePrice) + ' (disk tier only. Tape cartridges do not spin, so they do not wear out this way)',
        t.replacements * drivePrice),
      t.drives > 0 ? wearOutLine(t, drivePrice, years) : null,
      line('Replacement cartridges **', 'None. LTO cartridges are rated for ' + tapeLife() + ' years in archive, far longer than this ' + years + '-year period', 0),
      line('Power and cooling', tPow.kw.toFixed(1) + ' kW around the clock for ' + yrs(years) + ', cooling included. Cartridges on the shelf use no power',
        tPow.cost)
    ].filter(function (l) { return l; });

    // ---------- Cloud ----------
    var months = years * 12;
    var cloudLines = [
      line('Cloud storage', num(tb) + ' TB × ' + money2(p.cloud.usd_per_tb_month) + ' per TB per month × ' + months + ' months',
        tb * p.cloud.usd_per_tb_month * months)
    ];

    return {
      tb: tb, years: years, cartridges: cartridges, renewals: renewals,
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

  // *** Cozaint pricing and Media Lifecycle Renewal
  function cozaintNote(r) {
    var ret = lastCalc && lastCalc.retentionDays > 0 ? lastCalc.retentionDays : 0;
    var gen = lastCalc ? String(lastCalc.ltoCapacity) : '18';
    var renew = renewalPrice(gen);
    return '<div class="tco-footnote"><p><strong>*** Cozaint pricing.</strong> Everything Cozaint sells is shown at Cozaint list price (MSRP): ' +
      'Cozaint Certified LTO media, the MARCIA LTO library and expansion modules, LTO library drives, SAS connectivity and MARCIA base software. ' +
      'Libraries are sold without drives. The ' + Math.round(prices.tape_system.disk_tier_fraction * 100) + '% disk tier (drives, enclosure and server) is not a Cozaint product, so it is shown at market price.</p>' +
      (renew > 0 ? '<p><strong>MARCIA Media Lifecycle Renewal.</strong> The calculator buys enough cartridges to hold the retention period' +
        (ret ? ' (' + num(ret) + ' days)' : '') + '. When video on a cartridge is older than that, MARCIA automatically erases and reinitializes the cartridge ' +
        'and returns it to recording; Cozaint charges ' + money2(renew) + ' per cartridge each time (MSRP for this tape generation).</p>' +
        '<p><span class="tco-formula">renewals = cartridges × (days of ownership − retention days) ÷ retention days</span>. ' +
        'When the years of ownership equal the retention period, no cartridge is reused and there is no renewal charge.</p>' : '') +
      '</div>';
  }

  // **** Average complete surveillance system
  function systemsNote() {
    var list = systemsList();
    var items = list.map(function (x) {
      return '<li>' + link(x.source_url, x.name) + ': ' + money(x.price_usd) + ' for ' + num(x.raw_tb) + ' TB = ' + money2(x.price_usd / x.raw_tb) +
        ' per TB (' + esc(x.source_name) + ')</li>';
    }).join('');
    return '<div class="tco-footnote"><p><strong>**** Average complete surveillance system.</strong> The hard drive option is priced as a complete, ready-made ' +
      'video surveillance storage system (recorder or video server with drives, operating system and warranty), the way customers actually buy one, ' +
      'not as a do-it-yourself build from parts. Its price is the average price per TB of raw disk across ' + list.length + ' complete systems sold by US resellers:</p>' +
      '<ul class="tco-list">' + items + '</ul>' +
      '<p>Average: <strong>' + money2(avgPerRawTb()) + ' per TB of raw disk</strong>. The video needs about 20% more raw disk than its size, ' +
      'because RAID 6 uses 2 of every 12 drives for protection. Competitor prices are discounted reseller prices, while Cozaint is at full list price, ' +
      'so the comparison leans in the competitors\' favor. The average is refreshed every month.</p></div>';
  }

  // ** note: where the drive failure and wear-out figures come from.
  function failureNote() {
    var h = prices.hdd;
    var afr = (h.annual_failure_rate * 100).toFixed(2) + '%';
    return '<div class="tco-footnote"><p><strong>** How drive failures are counted.</strong> Hard drives spin 24 hours a day and wear out; ' +
      'tape cartridges sit still on a shelf until needed. The calculator counts two kinds of drive replacement:</p>' +
      '<p><strong>1. Failures during service.</strong> Drives × annualized failure rate × years. The rate comes from the industry-standard formula ' +
      '<span class="tco-formula">failure rate = failures ÷ (drive-days ÷ 365) × 100</span>, measured by ' +
      link(h.annual_failure_rate_source_url, 'Backblaze') + ' on about 350,000 drives running around the clock: ' + afr + ' a year.' +
      (h.manufacturer_afr ? ' Manufacturers quote a lower lab figure (' + (h.manufacturer_afr * 100).toFixed(2) +
        '% from a ' + (h.manufacturer_mtbf_hours / 1e6) + ' million hour MTBF rating); the calculator uses the real-world rate.' : '') +
      ' This is counted for the Cozaint disk tier. For the complete surveillance system it is assumed covered by the system warranty.</p>' +
      '<p><strong>2. Worn-out drives.</strong> Enterprise drives are rated and warrantied for ' + serviceLife() + ' years of 24/7 use (' +
      link(h.service_life_source_url, 'Seagate Exos X20') + '). Systems owned longer than that need every drive replaced, which the calculator adds for each ' +
      serviceLife() + '-year period (drives only, at market price). LTO cartridges are designed for a ' + tapeLife() + '-year archival life (' +
      link(prices.lto.archival_life_source_url, 'LTO media data sheet') + '), so the video on tape needs no replacement media.</p></div>';
  }

  function sourcesHtml() {
    var p = prices;
    var list = [
      ['Disk tier hard drives', p.hdd], ['Disk enclosure', p.disk_enclosure], ['Server', p.server],
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
    if (/cartridges|disk tier: hard drives|replacement drives|renewal/i.test(label)) return 'media';
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
    [['tape', 'Cozaint MARCIA'], ['hdd', 'HDD system (avg.)']].forEach(function (sys) {
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
      tape: { name: 'Cozaint MARCIA', total: r.tape.total, groups: grouped(r.tape) },
      hdd: { name: 'Average complete HDD surveillance system', total: r.hdd.total, groups: grouped(r.hdd) }
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
    var save = el('tcoSave');
    sub.textContent = '';
    if (saving > 0) {
      save.classList.remove('is-neg');
      el('tcoSaveLabel').textContent = 'You save with Cozaint MARCIA';
      el('tcoChartHero').textContent = money(saving);
      el('tcoSavePct').textContent = pct + '% lower cost';
      sub.appendChild(document.createTextNode('Savings over ' + yrs(r.years) + ' of ownership, for ' + num(r.tb) +
        ' TB of video, compared with the average complete hard drive surveillance system.'));
    } else {
      save.classList.add('is-neg');
      el('tcoSaveLabel').textContent = 'At this size, the average hard drive system costs less by';
      el('tcoChartHero').textContent = money(-saving);
      el('tcoSavePct').textContent = '';
      sub.appendChild(document.createTextNode('Over ' + yrs(r.years) + ' of ownership, for ' + num(r.tb) + ' TB of video.'));
    }
    var note = el('tcoCloudNote');
    note.textContent = '';
    var times = r.tape.total > 0 ? r.cloud.total / r.tape.total : 0;
    note.appendChild(document.createTextNode('Cloud storage for the same video: '));
    var s2 = document.createElement('strong'); s2.textContent = money(r.cloud.total);
    note.appendChild(s2);
    note.appendChild(document.createTextNode(times >= 1.1
      ? ', about ' + times.toFixed(1) + ' times the Cozaint MARCIA system.'
      : '.'));
  }

  // Years of ownership follow the retention period until the visitor changes them.
  var yearsTouched = false;
  function syncYears() {
    if (yearsTouched || !lastCalc || !(lastCalc.retentionDays > 0)) return;
    el('tcoYears').value = Math.max(1, Math.min(20, Math.round(lastCalc.retentionDays / 365)));
  }

  function render() {
    if (!prices || !lastCalc || !el('tcoBox')) return;
    syncYears();
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
      ? 'Cozaint MARCIA saves ' + money(saving) + ' (' + pct + '%) compared with the average complete hard drive surveillance system over ' + yrs(years) + ' of ownership.'
      : 'At this size, the average hard drive system costs less than Cozaint MARCIA.';

    el('tcoBreakdown').innerHTML =
      '<p class="tco-breakdown-title">* How these costs add up</p>' +
      table('Cozaint MARCIA (LTO tape with a ' + Math.round(prices.tape_system.disk_tier_fraction * 100) + '% disk tier)', r.tape) +
      table('Average complete hard drive surveillance system', r.hdd) +
      table('Cloud storage', r.cloud) +
      failureNote() +
      cozaintNote(r) +
      systemsNote() +
      '<p class="tco-notes">Prices updated ' + esc(prices.updated) + ' (Cozaint products at Cozaint list price; everything else at market or reseller prices)' +
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
    el('tcoYears').addEventListener('input', function () { yearsTouched = true; render(); });
    el('tcoYears').addEventListener('change', render);
    loadPrices(0);
  });
})();

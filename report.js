// Cozaint storage assessment: downloadable PDF handout for the customer.
// Built entirely in the visitor's browser with jsPDF (vendor/ folder);
// nothing is sent to Cozaint or anyone else.

(function () {
  var LIBS = ['vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js'];
  var LOGO = 'assets/cozaint-logo-green.png';
  var GREEN = [0, 138, 94], FOREST = [15, 46, 36], GREY = [91, 102, 96], LIGHT = [220, 243, 230], LINE = [216, 221, 212];
  var M = 50; // page margin (points)

  function el(id) { return document.getElementById(id); }
  function money(n) {
    var r = Math.round(n);
    return (r < 0 ? '-$' : '$') + Math.abs(r).toLocaleString('en-US');
  }
  function money2(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n) { return Math.round(n).toLocaleString('en-US'); }
  function yrs(n) { return n + (n === 1 ? ' year' : ' years'); }
  function site(url) { var m = /^https?:\/\/(?:www\.)?([^\/]+)/i.exec(url || ''); return m ? m[1] : ''; }

  // The PDF's built-in fonts cover Western characters only; swap the rest.
  var SWAP = { '−': '-', '→': '->', '↑': '', '≈': '~', ' ': ' ', ' ': ' ', ' ': ' ', '‑': '-' };
  var EXTRA = '–—‘’“”•…†‡€™‰';
  function clean(s) {
    return String(s == null ? '' : s).replace(/[^\x00-\xff]/g, function (c) {
      if (SWAP.hasOwnProperty(c)) return SWAP[c];
      return EXTRA.indexOf(c) >= 0 ? c : '';
    });
  }

  var loading = null;
  function loadLibs() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
    if (loading) return loading;
    loading = LIBS.reduce(function (p, src) {
      return p.then(function () {
        return new Promise(function (ok, fail) {
          var s = document.createElement('script');
          s.src = src; s.onload = ok; s.onerror = function () { fail(new Error('could not load ' + src)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
    loading.catch(function () { loading = null; });
    return loading;
  }

  function loadLogo() {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          ok({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { ok(null); }
      };
      img.onerror = function () { ok(null); };
      img.src = LOGO;
    });
  }

  function selText(id) {
    var s = el(id);
    return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : '';
  }
  function val(id) { var x = el(id); return x ? x.value : ''; }
  function txt(id) { var x = el(id); return x ? x.textContent.trim() : ''; }

  function build(logo) {
    var T = window.COZAINT_TCO, last = T && T.last;
    if (!last || !last.r) throw new Error('no result');
    var r = last.r, prices = T.prices();
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'pt', format: 'letter' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var name = val('calcCustomer').trim();
    var today = new Date();
    var dateText = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var y = M;

    function text(str, x, yy, opt) { doc.text(clean(str), x, yy, opt || {}); }
    function heading(str) {
      if (y > H - 120) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
      text(str, M, y); y += 8;
    }
    function para(str, size, color) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size || 9); var c = color || GREY; doc.setTextColor(c[0], c[1], c[2]);
      var lines = doc.splitTextToSize(clean(str), W - 2 * M);
      lines.forEach(function (ln) {
        if (y > H - 70) { doc.addPage(); y = M; }
        doc.text(ln, M, y); y += (size || 9) * 1.35;
      });
    }

    // ---------- Header ----------
    if (logo) doc.addImage(logo.data, 'PNG', M, y - 6, 120, 120 * logo.h / logo.w);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    text(dateText, W - M, y + 8, { align: 'right' });
    y += 46;
    if (name) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
      text('SAVINGS REPORT FOR', M, y); y += 24;
      doc.setFontSize(24); doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
      doc.splitTextToSize(clean(name), W - 2 * M).slice(0, 2).forEach(function (ln) { doc.text(ln, M, y); y += 26; });
      y -= 6;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
      text('Video Storage Savings Report', M, y); y += 20;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    text('Video storage cost assessment prepared by Cozaint', M, y); y += 22;

    // ---------- Savings box ----------
    var saving = r.hdd.total - r.tape.total;
    var pct = r.hdd.total > 0 ? Math.round(saving / r.hdd.total * 100) : 0;
    var boxH = 84;
    doc.setFillColor.apply(doc, saving > 0 ? LIGHT : [238, 240, 233]);
    doc.roundedRect(M, y, W - 2 * M, boxH, 8, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(saving > 0 ? GREEN[0] : GREY[0], saving > 0 ? GREEN[1] : GREY[1], saving > 0 ? GREEN[2] : GREY[2]);
    text(saving > 0 ? 'YOU SAVE WITH COZAINT MARCIA' : 'AT THIS SIZE, THE AVERAGE HARD DRIVE SYSTEM COSTS LESS BY', M + 16, y + 20);
    doc.setFontSize(30); doc.setTextColor(saving > 0 ? GREEN[0] : GREY[0], saving > 0 ? GREEN[1] : GREY[1], saving > 0 ? GREEN[2] : GREY[2]);
    text(money(Math.abs(saving)), M + 16, y + 52);
    if (saving > 0) {
      var amtW = doc.getTextWidth(money(saving));
      doc.setFontSize(12); text(pct + '% lower cost', M + 16 + amtW + 12, y + 52);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
    text('Over ' + yrs(r.years) + ' of ownership, for ' + num(r.tb) + ' TB of video, compared with the average complete hard drive surveillance system.', M + 16, y + 72);
    y += boxH + 26;

    // ---------- Three totals as bars ----------
    heading('Cost comparison');
    y += 10;
    var rows = [
      ['Cozaint MARCIA (LTO tape)', r.tape.total, GREEN],
      ['Hard drive surveillance system (average)', r.hdd.total, [91, 102, 96]],
      ['Cloud storage (average)', r.cloud.total, [147, 161, 154]]
    ];
    var max = Math.max(r.tape.total, r.hdd.total, r.cloud.total) || 1;
    var labelW = 210, amtW = 80, barX = M + labelW, barMax = W - 2 * M - labelW - amtW;
    rows.forEach(function (row) {
      doc.setFont('helvetica', row[2] === GREEN ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
      text(row[0], M, y + 9);
      doc.setFillColor(row[2][0], row[2][1], row[2][2]);
      doc.rect(barX, y, Math.max(2, barMax * row[1] / max), 12, 'F');
      doc.setFont('helvetica', 'bold');
      text(money(row[1]), W - M, y + 9, { align: 'right' });
      y += 22;
    });
    y += 4;
    para('Costs are added up over ' + yrs(r.years) + ' of ownership. Video is kept ' + num(last.calc.retentionDays) +
      ' days (retention). Cozaint products at Cozaint list price (MSRP); everything else at market or reseller prices as of ' +
      (prices.updated || dateText) + '.', 8.5);
    y += 10;

    // ---------- Inputs and sizing ----------
    var drives = (parseFloat(val('calcWriteDrives')) || 0) + (parseFloat(val('calcStandby')) || 0);
    var inputs = [
      ['Cameras', val('calcCameras'), 'Retention', num(last.calc.retentionDays) + ' days'],
      ['Resolution', selText('calcResolution'), 'Years you own the system', String(r.years)],
      ['Frames per second', val('calcFps'), 'LTO tape', selText('calcLto')],
      ['Motion', val('calcMotion') + '%', 'Tape drives', val('calcWriteDrives') + ' recording + ' + val('calcStandby') + ' standby (' + drives + ')'],
      ['Bits per pixel', val('calcBpp'), '', '']
    ];
    var results = [
      ['Bitrate per camera', txt('rBitrate'), 'Total video stored', txt('rTotalTb')],
      ['Storage per camera per day', txt('rPerCamDay'), 'LTO cartridges needed', txt('rSlots')],
      ['Cartridges written per day', txt('rSlotsDay'), 'Drive-hours needed per day', txt('rHours')]
    ];
    function kvTable(title, body) {
      heading(title);
      doc.autoTable({
        startY: y, margin: { left: M, right: M }, theme: 'plain',
        body: body.map(function (rw) { return rw.map(clean); }),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: FOREST },
        columnStyles: { 0: { textColor: GREY, cellWidth: 120 }, 1: { fontStyle: 'bold', cellWidth: 136 }, 2: { textColor: GREY, cellWidth: 120 }, 3: { fontStyle: 'bold' } },
        didParseCell: function (d) { if (d.row.index % 2 === 0) d.cell.styles.fillColor = [246, 244, 238]; }
      });
      y = doc.lastAutoTable.finalY + 22;
    }
    kvTable('Your system', inputs);
    kvTable('Storage needed', results);

    // Next step box
    var nb = 64;
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(1.2);
    doc.roundedRect(M, y, W - 2 * M, nb, 8, 8, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(FOREST[0], FOREST[1], FOREST[2]);
    text('Next step: validate this estimate with a Cozaint specialist', M + 16, y + 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    text('We will review your cameras, retention and site, and plan a tailored demonstration. No purchase commitment.', M + 16, y + 38);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    text('760-975-8000   |   info@cozaint.com   |   cozaint.com', M + 16, y + 53);
    doc.setLineWidth(0.2);

    // ---------- Breakdown ----------
    doc.addPage(); y = M;
    heading('How the costs add up');
    y += 6;
    function breakdown(title, part) {
      doc.autoTable({
        startY: y, margin: { left: M, right: M }, theme: 'striped',
        head: [[clean(title), '', 'Amount']],
        body: part.lines.map(function (l) { return [clean(l.label), clean(l.detail), clean(money(l.amount))]; })
          .concat([[{ content: 'Total', styles: { fontStyle: 'bold' } }, '', { content: clean(money(part.total)), styles: { fontStyle: 'bold' } }]]),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: FOREST, valign: 'top' },
        headStyles: { fillColor: FOREST, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [246, 244, 238] },
        columnStyles: { 0: { cellWidth: 150, fontStyle: 'bold' }, 1: { textColor: GREY }, 2: { cellWidth: 70, halign: 'right' } },
        didParseCell: function (d) { if (d.section === 'head' && d.column.index === 2) d.cell.styles.halign = 'right'; }
      });
      y = doc.lastAutoTable.finalY + 18;
    }
    breakdown('Cozaint MARCIA (LTO tape with a ' + Math.round(prices.tape_system.disk_tier_fraction * 100) + '% disk tier)', r.tape);
    breakdown('Average complete hard drive surveillance system', r.hdd);
    breakdown('Cloud storage (average)', r.cloud);

    // ---------- Notes ----------
    heading('Notes and sources');
    y += 8;
    var h = prices.hdd;
    para('** Drive failures. Hard drives spin 24 hours a day and wear out; tape cartridges sit still on a shelf until needed. Failures during service use the ' +
      'industry-standard annualized failure rate (failures / (drive-days / 365) x 100), measured by Backblaze on about 350,000 drives: ' +
      (h.annual_failure_rate * 100).toFixed(2) + '% a year. Enterprise drives are rated for ' + T.serviceLife() + ' years of 24/7 use, so systems owned longer replace every drive. ' +
      'LTO cartridges are designed for a ' + T.tapeLife() + '-year archival life. Sources: Backblaze Drive Stats (backblaze.com); LTO media data sheet.');
    y += 4;
    var renew = T.renewalPrice(last.calc.ltoCapacity);
    para('*** Cozaint pricing. Cozaint Certified LTO media, the MARCIA LTO library and expansion modules, LTO library drives, SAS connectivity and MARCIA base software are at Cozaint list price (MSRP). ' +
      'The ' + Math.round(prices.tape_system.disk_tier_fraction * 100) + '% disk tier is not a Cozaint product and is at market price.' +
      (renew ? ' MARCIA Media Lifecycle Renewal (' + money2(renew) + ' per cartridge) applies each time a cartridge is erased and returned to recording after its retention period: ' +
        'renewals = cartridges x (days of ownership - retention days) / retention days.' : ''));
    y += 4;
    para('**** Average complete hard drive surveillance system. Priced as a complete, ready-made video surveillance storage system (recorder or video server with drives), ' +
      'at the average price per TB of raw disk across systems from verified current system providers, at US reseller prices (' + money2(T.avgPerRawTb()) + ' per TB). RAID 6 needs about 20% more raw disk than the video stored.');
    T.systems().forEach(function (x, i) {
      para('   Verified current system provider ' + (i + 1) + ': ' + money(x.price_usd) + ' for ' + num(x.raw_tb) + ' TB = ' + money2(x.price_usd / x.raw_tb) + ' per TB', 8);
    });
    y += 4;
    var ca = T.cloud(r.tb);
    para('\u2020 Average cloud price. Standard storage, pay as you go, averaged across ' + ca.list.length + ' providers at ' + num(r.tb) + ' TB: ' + money2(ca.perTb) + ' per TB per month.');
    ca.list.forEach(function (x, i) {
      para('   ' + x.name + ': ' + money2(ca.per[i]) + ' per TB per month (' + site(x.source_url) + ')', 8);
    });
    y += 4;
    para('Not counted on any option: racks, network switches, video management (VMS) licenses, installation and support contracts. Cloud also leaves out the on-site recorder the cameras still need, ' +
      'the internet connection to upload video around the clock, download (retrieval) fees and minimum-storage fees, so the real cloud cost is higher.');
    y += 8;
    para('Planning estimate only. Results require validation by a Cozaint specialist before use in a final system design. Prices change; current prices are at cozaint.com.', 9, FOREST);

    // ---------- Footer on every page ----------
    var pages = doc.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(M, H - 40, W - M, H - 40);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GREY[0], GREY[1], GREY[2]);
      text('Cozaint Corporation  |  cozaint.com  |  760-975-8000  |  info@cozaint.com', M, H - 26);
      text('Page ' + i + ' of ' + pages, W - M, H - 26, { align: 'right' });
    }

    var safe = (name || 'Customer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Customer';
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    doc.save('Cozaint_Savings_Report_' + safe + '_' + iso + '.pdf');
  }

  function onClick(e) {
    var btn = e.currentTarget, msg = el('tcoReportMsg');
    if (msg) msg.textContent = '';
    if (!(window.COZAINT_TCO && window.COZAINT_TCO.last)) {
      if (msg) msg.textContent = 'Enter the number of cameras and retention days first, then try again.';
      return;
    }
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Creating PDF…';
    loadLibs().then(loadLogo).then(function (logo) { build(logo); })
      .catch(function () {
        if (msg) msg.textContent = 'The report could not be created. Please try again, or call 760-975-8000.';
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-report]'), function (b) {
      b.addEventListener('click', onClick);
    });
  });
})();

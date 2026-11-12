// Cozaint Storage Calculator
// Formula chain replicated exactly from ___Cozaint_Storage_Calculator_V6_1.xlsx
// (ResolutionSizes, Storage Calculator, Total_Calculator sheets)

(function () {
  var RESOLUTIONS = [
    { label: 'QCIF (176 x 120)', w: 176, h: 120 },
    { label: 'CIF (320 x 240)', w: 320, h: 240 },
    { label: '2CIF (704 x 240)', w: 704, h: 240 },
    { label: '4CIF (704 x 480)', w: 704, h: 480 },
    { label: 'VGA (640 x 480)', w: 640, h: 480 },
    { label: 'D1 (720 x 480)', w: 720, h: 480 },
    { label: 'WVGA (752 x 480)', w: 752, h: 480 },
    { label: 'SVGA (800 x 600)', w: 800, h: 600 },
    { label: 'XGA (1024 x 768)', w: 1024, h: 768 },
    { label: '720p HD (1280 x 720)', w: 1280, h: 720 },
    { label: '960p HD (1280 x 960)', w: 1280, h: 960 },
    { label: 'SXGA / 1.3MP (1280 x 1024)', w: 1280, h: 1024 },
    { label: 'HD+ (1600 x 900)', w: 1600, h: 900 },
    { label: 'UXGA / 2MP (1600 x 1200)', w: 1600, h: 1200 },
    { label: '1080p HD (1920 x 1080)', w: 1920, h: 1080, isDefault: true },
    { label: '2K HD (2048 x 1080)', w: 2048, h: 1080 },
    { label: 'QXGA / 3MP (2048 x 1536)', w: 2048, h: 1536 },
    { label: 'WQHD (2560 x 1440)', w: 2560, h: 1440 },
    { label: 'QSXGA / 5.2MP (2560 x 2045)', w: 2560, h: 2045 },
    { label: '5MP (2592 x 1944)', w: 2592, h: 1944 },
    { label: '3K HD (3072 x 1728)', w: 3072, h: 1728 },
    { label: '4K HD (4096 x 2160)', w: 4096, h: 2160 },
    { label: '20MP (5472 x 3648)', w: 5472, h: 3648 },
    { label: '8K HD (8192 x 4608)', w: 8192, h: 4608 }
  ];

  function motionFactor(pct) {
    if (pct >= 1 && pct <= 25) return 1.3;
    if (pct >= 26 && pct <= 50) return 2;
    if (pct >= 51 && pct <= 75) return 3;
    if (pct >= 76 && pct <= 100) return 4;
    return 1.3;
  }

  function fmt(n, decimals) {
    if (!isFinite(n)) return '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  }

  function init() {
    var resSelect = document.getElementById('calcResolution');
    if (!resSelect) return; // calculator not on this page

    RESOLUTIONS.forEach(function (r, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = r.label;
      if (r.isDefault) opt.selected = true;
      resSelect.appendChild(opt);
    });

    var camerasEl = document.getElementById('calcCameras');
    var fpsEl = document.getElementById('calcFps');
    var retentionEl = document.getElementById('calcRetention');
    var motionEl = document.getElementById('calcMotion');
    var bitrateEl = document.getElementById('calcBitrate');
    var motionValEl = document.getElementById('motionVal');
    var bppEl = document.getElementById('calcBpp');
    var ltoEl = document.getElementById('calcLto');

    var rBitrate = document.getElementById('rBitrate');
    var rPerCamDay = document.getElementById('rPerCamDay');
    var rTotalTb = document.getElementById('rTotalTb');
    var rSlots = document.getElementById('rSlots');
    var rSlotsDay = document.getElementById('rSlotsDay');
    var rHours = document.getElementById('rHours');
    var rDrives = document.getElementById('rDrives');
    var rDailyTb = document.getElementById('rDailyTb');

    function recalc() {
      var cameras = parseFloat(camerasEl.value) || 0;
      var res = RESOLUTIONS[parseInt(resSelect.value, 10)] || RESOLUTIONS[14];
      var fps = parseFloat(fpsEl.value) || 0;
      var retentionDays = parseFloat(retentionEl.value) || 0;
      var motionPct = Math.min(100, Math.max(1, parseFloat(motionEl.value) || 1));
      var bpp = parseFloat(bppEl.value) || 0.15;
      var ltoCapacity = parseFloat(ltoEl.value) || 30;

      if (motionValEl) motionValEl.textContent = motionPct + '%';

      // --- ResolutionSizes sheet chain ---
      var pixels = res.w * res.h;
      var resPerSec = pixels * fps;
      var baselineMbps = (resPerSec * bpp) / 1000000;
      var factor = motionFactor(motionPct);
      var bitrateWithFactor = baselineMbps * factor;
      var bitrateWithMotionPct = bitrateWithFactor * motionPct / 100;
      var bitrateKbps = bitrateWithMotionPct * 1000;

      // A bit rate typed by the visitor (kilobits per second) replaces the calculated one.
      var enteredKbps = bitrateEl ? parseFloat(bitrateEl.value) : NaN;
      var bitrateEntered = enteredKbps > 0;
      if (bitrateEl) bitrateEl.placeholder = fmt(bitrateKbps, 1); // grey hint = the calculated value
      if (bitrateEntered) bitrateKbps = enteredKbps;

      // --- Storage (decimal units, as tape capacities are: 1 TB = 1,000 GB = 1,000,000 MB) ---
      // Daily TB per camera = Mbps x 0.0108 (Mbps / 8 bits x 86,400 seconds / 1,000,000).
      var mbPerSec = bitrateKbps / 8 / 1000;
      var gbPerDayPerCam = mbPerSec * 86400 / 1000;
      var dailyTbAll = gbPerDayPerCam * cameras / 1000;
      var totalTbAllCameras = dailyTbAll * retentionDays;

      // --- Cartridges ---
      var roundedTotalTb = Math.round(totalTbAllCameras / 10) * 10;
      var slotsNeeded = ltoCapacity > 0 ? roundedTotalTb / ltoCapacity : 0;
      var slotsPerDay = retentionDays > 0 ? Math.ceil(slotsNeeded / retentionDays) : 0;

      // --- LTO drives (MARCIA planning method) ---
      // One drive writes for 23.5 hours a day (half-hour buffer) at 70% of its rated speed:
      // 210 MB/s for LTO-8 and LTO-9, 280 MB/s for LTO-10.
      // TB per 23.5 hours = MB/s x 84,600 / 1,000,000. Add write drives until the day's video fits,
      // then one more drive for recall and playback.
      var driveMBps = ltoCapacity >= 30 ? 280 : 210;
      var tbPerDrivePerDay = driveMBps * 84600 / 1000000;
      var writeDrives = Math.max(1, Math.ceil(dailyTbAll / tbPerDrivePerDay));
      var totalDrives = writeDrives + 1;
      var writeHoursPerDrive = writeDrives > 0 ? (dailyTbAll * 1000000 / driveMBps / 3600) / writeDrives : 0;
      var wh = Math.floor(writeHoursPerDrive), wm = Math.round((writeHoursPerDrive - wh) * 60);
      if (wm === 60) { wh += 1; wm = 0; }

      rBitrate.textContent = fmt(bitrateKbps, 1) + ' Kbps' + (bitrateEntered ? ' (entered)' : '');
      rPerCamDay.textContent = fmt(gbPerDayPerCam, 2) + ' GB';
      rTotalTb.textContent = fmt(roundedTotalTb, 0) + ' TB';
      rSlots.textContent = fmt(Math.ceil(slotsNeeded), 0) + ' cartridges';
      rSlotsDay.textContent = fmt(slotsPerDay, 0) + ' / day';
      rDailyTb.textContent = fmt(dailyTbAll, 2) + ' TB';
      rDrives.textContent = fmt(totalDrives, 0) + ' (' + fmt(writeDrives, 0) + ' write + 1 recall)';
      rHours.textContent = wh + ' hr ' + wm + ' min' + (writeDrives > 1 ? ' per write drive' : '') + ' at ' + driveMBps + ' MB/s';

      // Hand the sizing results to the cost comparison (tco.js)
      document.dispatchEvent(new CustomEvent('cozaint:calc', {
        detail: {
          totalTb: roundedTotalTb,
          ltoCapacity: ltoCapacity,
          cartridges: Math.ceil(slotsNeeded),
          tapeDrives: totalDrives,
          writeDrives: writeDrives,
          driveMBps: driveMBps,
          dailyTb: dailyTbAll,
          retentionDays: retentionDays
        }
      }));
    }

    [camerasEl, resSelect, fpsEl, retentionEl, motionEl, bitrateEl, bppEl, ltoEl].forEach(function (el) {
      el.addEventListener('input', recalc);
      el.addEventListener('change', recalc);
    });

    recalc();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

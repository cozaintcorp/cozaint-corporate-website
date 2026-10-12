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
    var motionValEl = document.getElementById('motionVal');
    var bppEl = document.getElementById('calcBpp');
    var ltoEl = document.getElementById('calcLto');
    var hoursEl = document.getElementById('calcHours');
    var writeDrivesEl = document.getElementById('calcWriteDrives');
    var standbyEl = document.getElementById('calcStandby');

    var rBitrate = document.getElementById('rBitrate');
    var rPerCamDay = document.getElementById('rPerCamDay');
    var rTotalTb = document.getElementById('rTotalTb');
    var rSlots = document.getElementById('rSlots');
    var rSlotsDay = document.getElementById('rSlotsDay');
    var rHours = document.getElementById('rHours');

    function recalc() {
      var cameras = parseFloat(camerasEl.value) || 0;
      var res = RESOLUTIONS[parseInt(resSelect.value, 10)] || RESOLUTIONS[14];
      var fps = parseFloat(fpsEl.value) || 0;
      var retentionDays = parseFloat(retentionEl.value) || 0;
      var motionPct = parseFloat(motionEl.value) || 1;
      var bpp = parseFloat(bppEl.value) || 0.15;
      var ltoCapacity = parseFloat(ltoEl.value) || 18;
      var hoursPerCartridge = parseFloat(hoursEl.value) || 7;
      var writeDrives = parseFloat(writeDrivesEl.value) || 3;
      var standby = parseFloat(standbyEl.value) || 0;

      motionValEl.textContent = motionPct + '%';

      // --- ResolutionSizes sheet chain ---
      var pixels = res.w * res.h;
      var resPerSec = pixels * fps;
      var baselineMbps = (resPerSec * bpp) / 1000000;
      var factor = motionFactor(motionPct);
      var bitrateWithFactor = baselineMbps * factor;
      var bitrateWithMotionPct = bitrateWithFactor * motionPct / 100;
      var bitrateKbps = bitrateWithMotionPct * 1000;

      // --- Storage Calculator sheet chain ---
      var bytesKbPerSec = bitrateKbps / 8;
      var mbPerSec = bytesKbPerSec / 1024;
      var mbPerHour = mbPerSec * 3600;
      var mbPerDayPerCam = mbPerHour * 24;
      var gbPerDayPerCam = mbPerDayPerCam / 1024;
      var totalGbPerCamRetention = gbPerDayPerCam * retentionDays;
      var totalTbPerCamRetention = totalGbPerCamRetention / 1024;
      var totalTbAllCameras = totalTbPerCamRetention * cameras;

      // --- Total_Calculator sheet chain ---
      var roundedTotalTb = Math.round(totalTbAllCameras / 10) * 10;
      var slotsNeeded = ltoCapacity > 0 ? roundedTotalTb / ltoCapacity : 0;
      var slotsPerDay = retentionDays > 0 ? Math.ceil(slotsNeeded / retentionDays) : 0;
      var totalHoursPerDay = hoursPerCartridge * slotsPerDay;
      var totalDrives = Math.max(writeDrives + standby, 2);

      rBitrate.textContent = fmt(bitrateKbps, 1) + ' Kbps';
      rPerCamDay.textContent = fmt(gbPerDayPerCam, 2) + ' GB';
      rTotalTb.textContent = fmt(roundedTotalTb, 0) + ' TB';
      rSlots.textContent = fmt(Math.ceil(slotsNeeded), 0) + ' cartridges';
      rSlotsDay.textContent = fmt(slotsPerDay, 0) + ' / day';
      rHours.textContent = fmt(totalHoursPerDay, 1) + ' hrs (' + fmt(totalDrives, 0) + ' drives incl. standby)';
    }

    [camerasEl, resSelect, fpsEl, retentionEl, motionEl, bppEl, ltoEl, hoursEl, writeDrivesEl, standbyEl].forEach(function (el) {
      el.addEventListener('input', recalc);
      el.addEventListener('change', recalc);
    });

    recalc();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// MARCIA homepage — lightweight interactions
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('assessment-form');
  if (form) {
    var LEAD_EMAIL = 'info@cozaint.com';
    var status = document.getElementById('formStatus');
    var src = (new URLSearchParams(location.search).get('product') || 'assessment');
    document.getElementById('leadSource').value = 'assessment page (' + src + ')';
    function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function calcSummary() {
      var res = document.getElementById('calcResolution');
      var resText = res && res.options && res.selectedIndex >= 0 ? res.options[res.selectedIndex].text : '';
      return 'Customer: ' + val('calcCustomer') + '; Cameras: ' + val('calcCameras') + '; Resolution: ' + resText +
        '; FPS: ' + val('calcFps') + '; Retention days: ' + val('calcRetention');
    }
    function fallback(data) {
      var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nPhone: ' + data.phone + '\nCompany: ' + data.company +
        '\nGoal: ' + data.improve + '\n' + data.calc;
      var href = 'mailto:' + LEAD_EMAIL + '?subject=' + encodeURIComponent('Assessment request') + '&body=' + encodeURIComponent(body);
      status.className = 'form-status err';
      status.innerHTML = 'We could not send that automatically. Please <a href="' + href + '">email us</a> or call 760-975-8000.';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status'; status.textContent = '';
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      document.getElementById('leadCalc').value = calcSummary();
      var data = {
        name: val('leadName').trim(), email: val('leadEmail').trim(), phone: val('leadPhone').trim(),
        company: val('company').trim(), improve: form.querySelector('#improve').selectedOptions[0].text,
        website: form.querySelector('[name=website]').value, source: val('leadSource'), calc: val('leadCalc')
      };
      var button = form.querySelector('button[type="submit"]');
      var originalText = button.textContent;
      button.textContent = 'Sending...';
      button.disabled = true;
      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.ok }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error('send failed');
          status.className = 'form-status ok';
          status.textContent = 'Thank you. A Cozaint specialist will be in touch shortly.';
          form.reset();
          button.textContent = 'Request sent';
          setTimeout(function () { button.textContent = originalText; button.disabled = false; }, 4000);
        })
        .catch(function () {
          fallback(data);
          button.textContent = originalText;
          button.disabled = false;
        });
    });
  }

  // Hero: big centered play button starts the narrated video.
  // Mute button toggles sound. Video shows a replay control at the end.
  // Uses two video elements swapped on replay, since this file has proven
  // unreliable when seeking the same element back to time 0 in-browser.
  var videoA = document.getElementById('heroVideo');
  var videoB = document.getElementById('heroVideoAlt');
  var playBig = document.getElementById('heroPlayBig');
  var muteBtn = document.getElementById('heroMuteBtn');

  if (videoA && videoB && muteBtn) {
    var current = videoA;
    var other = videoB;
    var NEAR_END = 0.5;

    function isNearEnd(v) {
      return v.duration && v.currentTime >= v.duration - NEAR_END;
    }

    function showPlayIcon() {
      playBig.textContent = '▶';
      playBig.classList.remove('is-playing');
    }
    function showReplayIcon() {
      playBig.textContent = '↻';
      playBig.classList.remove('is-playing');
    }
    function showPlayingState() {
      playBig.textContent = '▶';
      playBig.classList.add('is-playing');
    }

    current.addEventListener('timeupdate', function () {
      if (isNearEnd(current) && !current.paused) {
        current.pause();
        showReplayIcon();
      }
    });

    playBig.addEventListener('click', function () {
      if (current.paused && isNearEnd(current)) {
        // Swap to the other (fresh, already-at-0) video element.
        current.style.display = 'none';
        other.style.display = '';
        other.muted = current.muted;
        var prev = current;
        current = other;
        other = prev;
        current.currentTime = 0;
        current.play();
        current.addEventListener('timeupdate', function onTime() {
          if (isNearEnd(current) && !current.paused) {
            current.pause();
            showReplayIcon();
          }
        });
      } else if (current.paused) {
        current.play();
      } else {
        current.pause();
      }
    });

    current.addEventListener('play', showPlayingState);
    current.addEventListener('pause', function () {
      if (!isNearEnd(current)) { showPlayIcon(); }
    });

    muteBtn.addEventListener('click', function () {
      var muted = !current.muted;
      videoA.muted = muted;
      videoB.muted = muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }
});

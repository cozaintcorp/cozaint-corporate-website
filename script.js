// MARCIA homepage — lightweight interactions
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('assessment-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var company = document.getElementById('company').value.trim();
      var button = form.querySelector('button[type="submit"]');
      var originalText = button.textContent;
      if (!company) return;
      button.textContent = 'Request sent';
      button.disabled = true;
      form.reset();
      setTimeout(function () {
        button.textContent = originalText;
        button.disabled = false;
      }, 3000);
      // NOTE: this form currently only simulates a submission.
      // Wire it up to your actual lead-capture endpoint (email service,
      // CRM webhook, etc.) before this goes live to real visitors.
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

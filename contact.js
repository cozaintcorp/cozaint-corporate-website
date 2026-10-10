// Contact page form: sends to EspoCRM Lead Capture (see lead-config.js), or falls back to email.
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var cfg = window.COZAINT_LEAD || {};
  var EMAIL = cfg.email || 'info@cozaint.com';
  var ENDPOINT = cfg.endpoint || '';
  var status = document.getElementById('cStatus');
  var sel = document.getElementById('cInterest');
  var q = new URLSearchParams(location.search).get('product');
  if (q) { for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === q) { sel.selectedIndex = i; break; } } }
  function v(id) { return document.getElementById(id).value.trim(); }
  function fallback(d) {
    var body = 'Name: ' + d.name + '\nEmail: ' + d.email + '\nPhone: ' + d.phone + '\nCompany: ' + d.company +
      '\nInterested in: ' + d.interest + '\n\n' + d.message;
    var href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Website inquiry: ' + d.interest) + '&body=' + encodeURIComponent(body);
    status.className = 'form-status err';
    status.innerHTML = 'We could not send that automatically. Please <a href="' + href + '">email us</a> or call 760-975-8000.';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = '';
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var d = { name: v('cName'), email: v('cEmail'), phone: v('cPhone'), company: v('cCompany'),
      interest: sel.options[sel.selectedIndex].text, message: v('cMessage'), trap: form.querySelector('[name=website]').value };
    var btn = form.querySelector('button[type="submit"]'); var label = btn.textContent;
    if (d.trap) { form.reset(); return; }
    if (!ENDPOINT) { fallback(d); return; }
    btn.textContent = 'Sending...'; btn.disabled = true;
    var parts = d.name.split(/\s+/);
    var payload = {
      firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : null,
      lastName: parts.length > 1 ? parts[parts.length - 1] : parts[0],
      emailAddress: d.email, phoneNumber: d.phone || null, accountName: d.company || null,
      description: 'Interested in: ' + d.interest + '\nFrom: contact page\n\n' + d.message
    };
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (r.status !== 200) throw new Error('send failed'); })
      .then(function () {
        status.className = 'form-status ok';
        status.textContent = 'Thank you. A Cozaint specialist will be in touch shortly.';
        form.reset(); btn.textContent = 'Request sent';
        setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 4000);
      })
      .catch(function () { fallback(d); btn.textContent = label; btn.disabled = false; });
  });
});

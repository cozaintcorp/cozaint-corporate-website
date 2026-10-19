// One place to set where website forms send their leads.
// endpoint: the Google lead box web app address (ends in /exec). See the lead
//           capture setup guide, Step 1. Each lead is saved in the Leads sheet,
//           emailed to info@cozaint.com, and copied into EspoCRM by the relay.
// While endpoint is empty, forms offer an email to `email` instead.
window.COZAINT_LEAD = {
  email: 'info@cozaint.com',
  endpoint: '',

  // Sends one lead to the lead box. Resolves when the box confirms it saved the
  // lead; rejects otherwise (the form then shows the email/phone fallback).
  send: function (lead) {
    var url = this.endpoint;
    if (!url || !window.fetch) return Promise.reject(new Error('no endpoint'));
    lead.page = lead.page || location.href.split('#')[0];
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    // text/plain keeps this a "simple" request, which Google's web apps accept from any site.
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(lead),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'not saved');
      return res;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }
};

/* Yellow PREVIEW banner. Shows ONLY on the GitHub preview site (cozaintcorp.github.io),
   never on cozaint.com, so it is harmless if this file is uploaded to the live site.
   Update CHANGES for each new preview. */
(function () {
  if (location.hostname.indexOf('github.io') === -1) return;
  var TITLE = 'PREVIEW of the next website update (in progress, not yet approved). Not on cozaint.com yet.';
  var CHANGES = [
    ['Home (Hollywood picture, More link)', 'index.html'],
    ['Proven by Hollywood (new page)', 'hollywood.html'],
    ['MARCIA (video: company name now pronounced correctly)', 'marcia.html'],
    ['Banks (new: questionnaire & webinar button)', 'banks.html'],
    ['Calculator (LTO choice, LTO drive count)', 'assessment.html#calculator']
  ];
  var base = location.pathname.replace(/[^\/]*$/, '');
  var d = document.createElement('div');
  d.setAttribute('role', 'note');
  d.style.cssText = 'position:relative;z-index:99999;background:#ffd84d;color:#1a1a1a;font:600 15px/1.5 Arial,sans-serif;' +
    'padding:10px 16px;text-align:center;border-bottom:3px solid #c9a400';
  var html = TITLE + '<br>Changed pages: ';
  html += CHANGES.map(function (c) {
    return '<a href="' + base + c[1] + '" style="color:#0f2e24;text-decoration:underline;margin:0 4px">' + c[0] + '</a>';
  }).join(' · ');
  d.innerHTML = html;
  document.body.insertBefore(d, document.body.firstChild);
})();

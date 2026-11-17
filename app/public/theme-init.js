// Applies the saved light/dark theme before first paint (no white flash in dark mode).
(function () {
  var t = null;
  try { t = localStorage.getItem('mflight-theme'); } catch (e) { /* ignore */ }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  var r = document.documentElement;
  r.classList.toggle('dark', t === 'dark');
  r.setAttribute('data-theme', t);
  r.style.colorScheme = t;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#07090D' : '#FFFFFF');
})();

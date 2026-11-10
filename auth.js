/* Prototype sign-in: accounts live in this file and the session in localStorage.
   shortcut: client-side only, anyone can read the codes or edit storage; replace with a real server login before real use. */
(function () {
  var KEY = 'dailytrack.session.v1';
  var USERS = {
    T01: { pw: '1234', role: 'tech', name: 'สมชาย ป.' },
    S01: { pw: '9999', role: 'sup', name: 'หัวหน้า' }
  };
  var HOME = { tech: 'index.html', sup: 'supervisor.html' };

  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      return s && HOME[s.role] ? s : null;
    } catch (e) { return null; }
  }

  // returns the page to open, null for a wrong code or password, false when the browser refuses to store the session
  window.Auth = {
    login: function (code, pw) {
      var u = USERS[String(code).trim().toUpperCase()];
      if (!u || u.pw !== pw) return null;
      try { localStorage.setItem(KEY, JSON.stringify({ role: u.role, name: u.name })); } catch (e) { return false; }
      return HOME[u.role];
    }
  };

  // each page names its audience: data-role="tech" | "sup" | "login"
  var want = document.currentScript && document.currentScript.dataset.role;
  var s = session();
  if (want === 'login') {
    if (s) location.replace(HOME[s.role]);
  } else if (!s || s.role !== want) {
    location.replace(s ? HOME[s.role] : 'login.html');
  }

  // back button after logging out must not show a cached page
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && want !== 'login' && !session()) location.replace('login.html');
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#logout')) return;
    try { localStorage.removeItem(KEY); } catch (x) { /* nothing stored, nothing to clear */ }
    location.replace('login.html');
  });
})();

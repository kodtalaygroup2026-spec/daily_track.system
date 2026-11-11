/* Prototype sign-in: accounts live in this file and the session in localStorage.
   shortcut: client-side only, anyone can read the codes or edit storage; replace with a real server login before real use. */
(function () {
  var KEY = 'dailytrack.session.v1';
  var NAMES = 'dailytrack.names.v1'; // display names a user changed, by employee code
  var USERS = {
    T01: { pw: '1234', role: 'tech', name: 'สมชาย ป.' },
    S01: { pw: '9999', role: 'sup', name: 'หัวหน้า' }
  };
  var HOME = { tech: 'index.html', sup: 'supervisor.html' };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function session() {
    var s = read(KEY);
    return s && s.code && HOME[s.role] ? s : null; // a session without a code is from an older build: sign in again
  }

  window.Auth = {
    session: session,
    // returns the page to open, null for a wrong code or password, false when the browser refuses to store the session
    login: function (code, pw) {
      code = String(code).trim().toUpperCase();
      var u = USERS[code];
      if (!u || u.pw !== pw) return null;
      var name = (read(NAMES) || {})[code] || u.name;
      try { localStorage.setItem(KEY, JSON.stringify({ code: code, role: u.role, name: name })); } catch (e) { return false; }
      return HOME[u.role];
    },
    // keeps the new name for the next sign-in too; false when storage refuses or nobody is signed in
    rename: function (name) {
      var s = session();
      if (!s) return false;
      var names = read(NAMES) || {};
      names[s.code] = name;
      s.name = name;
      try {
        localStorage.setItem(NAMES, JSON.stringify(names));
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) { return false; }
      return true;
    },
    home: function () { var s = session(); return s ? HOME[s.role] : 'login.html'; }
  };

  // each page names its audience: data-role="tech" | "sup" | "any" (either role) | "login"
  var want = document.currentScript && document.currentScript.dataset.role;
  var s = session();
  if (want === 'login') {
    if (s) location.replace(HOME[s.role]);
  } else if (want === 'any') {
    if (!s) location.replace('login.html');
  } else if (!s || s.role !== want) {
    location.replace(s ? HOME[s.role] : 'login.html');
  }

  // show the signed-in name wherever a page has #whoName
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('whoName'), cur = session();
    if (el && cur) el.textContent = cur.name;
  });

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

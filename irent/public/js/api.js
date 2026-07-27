// Couche d'accès à l'API + gestion de la session (jeton JWT en localStorage)
const API = (() => {
  const TOKEN_KEY = 'irent_token';
  const USER_KEY = 'irent_user';

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  }
  function setSession(t, u) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* pas de corps */ }
    if (!res.ok) {
      const msg = (data && data.error) || 'Une erreur est survenue.';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    token, user, setSession, clearSession,
    isLoggedIn: () => !!token(),
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    patch: (p, b) => request('PATCH', p, b),
    del: (p) => request('DELETE', p),
  };
})();

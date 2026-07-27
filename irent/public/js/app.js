// iRent — application monopage (SPA) en JavaScript pur
(() => {
  const app = document.getElementById('app');
  const navLinks = document.getElementById('navLinks');
  const modalRoot = document.getElementById('modal-root');

  // Emojis par catégorie pour les visuels de repli
  const CAT_ICON = {
    'Outils': '🔧', 'Jardinage': '🌱', 'Construction': '🏗️', 'Électronique': '💻',
    'Sport & Plein air': '🚴', 'Événementiel': '🎪', 'Automobile': '🚗',
    'Nettoyage': '🧹', 'Cuisine': '🍳', 'Autre': '📦',
  };
  const CATEGORIES = Object.keys(CAT_ICON);

  const STATUS_LABEL = {
    en_attente: 'En attente', confirmee: 'Confirmée', en_cours: 'En cours',
    terminee: 'Terminée', annulee: 'Annulée',
  };

  // ---------- Utilitaires ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2) + ' $';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iconFor = (cat) => CAT_ICON[cat] || '📦';
  const fmtDate = (s) => s ? new Date(s.length <= 10 ? s + 'T00:00:00' : s).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const todayISO = () => new Date().toISOString().slice(0, 10);

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function stars(avg, count) {
    if (!avg) return `<span class="muted" style="font-size:13px">Pas encore d'avis</span>`;
    return `<span class="stars">★ ${avg.toFixed(1)}</span> <span class="muted" style="font-size:12px">(${count})</span>`;
  }

  function starRow(avg) {
    const full = Math.round(avg || 0);
    return '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
  }

  // ---------- Modale ----------
  function openModal(title, bodyHTML, onMount) {
    modalRoot.innerHTML = `
      <div class="modal-back" id="mback">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head"><h2>${title}</h2><button class="modal-x" id="mx" aria-label="Fermer">×</button></div>
          <div class="modal-body">${bodyHTML}</div>
        </div>
      </div>`;
    const close = () => { modalRoot.innerHTML = ''; };
    $('#mx').onclick = close;
    $('#mback').onclick = (e) => { if (e.target.id === 'mback') close(); };
    if (onMount) onMount({ close });
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  // ---------- Barre de navigation ----------
  function renderNav() {
    const u = API.user();
    if (u) {
      const initials = u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      navLinks.innerHTML = `
        <a href="#/">Explorer</a>
        <a href="#/dashboard">Tableau de bord</a>
        <a href="#/dashboard?tab=new" class="btn btn-primary btn-sm" style="color:#fff">+ Publier un bien</a>
        <button class="linklike" id="logoutBtn">Déconnexion</button>
        <div class="nav-avatar" title="${esc(u.name)}">${esc(initials)}</div>`;
      $('#logoutBtn').onclick = () => { API.clearSession(); toast('À bientôt !'); location.hash = '#/'; renderNav(); };
    } else {
      navLinks.innerHTML = `
        <a href="#/">Explorer</a>
        <a href="#/login">Connexion</a>
        <a href="#/register" class="btn btn-primary btn-sm" style="color:#fff">S'inscrire</a>`;
    }
  }

  // ---------- Routeur ----------
  async function router() {
    const raw = location.hash.slice(1) || '/';
    const [path, queryStr] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryStr || ''));
    window.scrollTo(0, 0);
    renderNav();

    try {
      if (path === '/' || path === '') return await viewHome(query);
      if (path === '/login') return viewAuth('login');
      if (path === '/register') return viewAuth('register');
      if (path.startsWith('/item/')) return await viewItem(path.split('/')[2]);
      if (path === '/dashboard') {
        if (!API.isLoggedIn()) { location.hash = '#/login'; return; }
        return await viewDashboard(query);
      }
      app.innerHTML = `<div class="container"><div class="empty"><div class="ico">🤷</div>Page introuvable.</div></div>`;
    } catch (e) {
      app.innerHTML = `<div class="container"><div class="empty"><div class="ico">⚠️</div>${esc(e.message)}</div></div>`;
    }
  }

  // ---------- Vue : accueil / catalogue ----------
  async function viewHome(query) {
    app.innerHTML = `
      <div class="container">
        <section class="hero">
          <h1>Louez ce dont vous avez besoin,<br>près de chez vous.</h1>
          <p>Tondeuses, perceuses, remorques, équipement de plein air… iRent met en relation ceux qui possèdent et ceux qui ont besoin. Vous gagnez de l'argent avec vos objets, ou vous économisez en louant plutôt qu'en achetant.</p>
          <form class="searchbar" id="heroSearch">
            <input name="q" placeholder="Que cherchez-vous ? (ex. perceuse, remorque…)" value="${esc(query.q || '')}" />
            <button class="btn btn-primary" type="submit">Rechercher</button>
          </form>
          <div class="hero-badges">
            <div class="hero-badge">✅ Inscription gratuite</div>
            <div class="hero-badge">🛡️ Dépôt de garantie sécurisé</div>
            <div class="hero-badge">🧾 Facturation automatique</div>
          </div>
        </section>

        <div class="chips" id="catChips"></div>
        <div class="filters">
          <input id="fCity" placeholder="Ville" value="${esc(query.city || '')}" />
          <select id="fMax">
            <option value="">Prix max / jour</option>
            <option value="20">≤ 20 $</option>
            <option value="50">≤ 50 $</option>
            <option value="100">≤ 100 $</option>
            <option value="250">≤ 250 $</option>
          </select>
        </div>

        <div id="catalog"><div class="spinner">Chargement des biens…</div></div>
      </div>`;

    const chips = $('#catChips');
    chips.innerHTML = `<div class="chip ${!query.category ? 'active' : ''}" data-cat="">Tout</div>` +
      CATEGORIES.map(c => `<div class="chip ${query.category === c ? 'active' : ''}" data-cat="${esc(c)}">${iconFor(c)} ${esc(c)}</div>`).join('');

    const state = { q: query.q || '', category: query.category || '', city: query.city || '', max_price: query.max_price || '' };
    if (query.max_price) $('#fMax').value = query.max_price;

    async function load() {
      const params = new URLSearchParams();
      Object.entries(state).forEach(([k, v]) => { if (v) params.set(k, v); });
      const cat = $('#catalog');
      cat.innerHTML = `<div class="spinner">Chargement…</div>`;
      const { items } = await API.get('/items?' + params.toString());
      if (!items.length) {
        cat.innerHTML = `<div class="empty"><div class="ico">🔍</div>Aucun bien ne correspond à votre recherche.<br><span class="muted">Essayez d'élargir vos critères.</span></div>`;
        return;
      }
      cat.innerHTML = `<div class="grid">${items.map(cardHTML).join('')}</div>`;
      cat.querySelectorAll('.card').forEach(c => c.onclick = () => location.hash = '#/item/' + c.dataset.id);
    }

    $('#heroSearch').onsubmit = (e) => { e.preventDefault(); state.q = e.target.q.value; load(); };
    chips.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
      state.category = ch.dataset.cat;
      chips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      ch.classList.add('active');
      load();
    });
    let cityTimer;
    $('#fCity').oninput = (e) => { clearTimeout(cityTimer); state.city = e.target.value; cityTimer = setTimeout(load, 350); };
    $('#fMax').onchange = (e) => { state.max_price = e.target.value; load(); };

    load();
  }

  function cardHTML(it) {
    const img = it.image_url
      ? `<img src="${esc(it.image_url)}" alt="${esc(it.title)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'placeholder',textContent:'${iconFor(it.category)}'}))" />`
      : `<div class="placeholder">${iconFor(it.category)}</div>`;
    return `
      <div class="card" data-id="${it.id}">
        <div class="card-img">${img}<span class="card-cat">${iconFor(it.category)} ${esc(it.category)}</span></div>
        <div class="card-body">
          <div class="card-title">${esc(it.title)}</div>
          <div class="card-city">📍 ${esc(it.city || 'Non précisé')} · ${esc(it.owner_name)}</div>
          <div class="card-foot">
            <div class="price">${money(it.price_day)}<small> /jour</small></div>
            <div>${stars(it.rating_avg, it.rating_count)}</div>
          </div>
        </div>
      </div>`;
  }

  // ---------- Vue : détail d'un bien ----------
  async function viewItem(id) {
    app.innerHTML = `<div class="container"><div class="spinner">Chargement…</div></div>`;
    const { item, reviews } = await API.get('/items/' + id);
    const u = API.user();
    const isOwner = u && u.id === item.owner_id;
    const hero = item.image_url
      ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${iconFor(item.category)}',style:'font-size:72px'}))" />`
      : iconFor(item.category);

    app.innerHTML = `
      <div class="container">
        <a href="#/" class="muted">← Retour au catalogue</a>
        <div class="two-col" style="margin-top:14px">
          <div>
            <div class="gallery-hero">${hero}</div>
            <div class="page-head" style="margin-top:20px">
              <div>
                <span class="card-cat" style="position:static;display:inline-block;margin-bottom:8px">${iconFor(item.category)} ${esc(item.category)}</span>
                <h1 style="margin:0">${esc(item.title)}</h1>
                <p>📍 ${esc(item.city || 'Non précisé')} · Proposé par <strong>${esc(item.owner_name)}</strong></p>
                <div>${stars(item.rating_avg, item.rating_count)}</div>
              </div>
            </div>
            <div class="panel">
              <div class="section-title" style="margin-top:0">Description</div>
              <p style="white-space:pre-wrap;margin:0">${esc(item.description || 'Aucune description fournie.')}</p>
            </div>
            <div class="section-title">Avis des locataires (${reviews.length})</div>
            <div id="reviews">${reviews.length ? reviews.map(reviewHTML).join('') : '<p class="muted">Aucun avis pour le moment.</p>'}</div>
          </div>

          <div>
            <div class="panel" style="position:sticky;top:84px">
              <div class="price" style="font-size:26px">${money(item.price_day)}<small> /jour</small></div>
              <p class="muted" style="font-size:13px;margin:6px 0 16px">Dépôt de garantie : ${money(item.deposit)} (remboursable)</p>
              <div id="bookBox"></div>
            </div>
          </div>
        </div>
      </div>`;

    const box = $('#bookBox');
    if (isOwner) {
      box.innerHTML = `<p class="muted">Ceci est votre bien. Gérez-le depuis votre <a href="#/dashboard">tableau de bord</a>.</p>`;
    } else if (!u) {
      box.innerHTML = `<a href="#/login" class="btn btn-primary btn-block">Connectez-vous pour réserver</a>`;
    } else {
      box.innerHTML = `
        <div class="field"><label>Début</label><input type="date" id="bStart" min="${todayISO()}" value="${todayISO()}"></div>
        <div class="field"><label>Fin</label><input type="date" id="bEnd" min="${todayISO()}"></div>
        <div class="field"><label>Message au propriétaire (optionnel)</label><textarea id="bMsg" placeholder="Bonjour, j'aimerais louer…"></textarea></div>
        <div id="quoteBox" class="muted" style="font-size:13px;margin-bottom:12px"></div>
        <button class="btn btn-primary btn-block" id="bookBtn">Demander à réserver</button>`;

      const recalc = async () => {
        const s = $('#bStart').value, e = $('#bEnd').value;
        const qb = $('#quoteBox');
        if (!s || !e || e <= s) { qb.innerHTML = 'Choisissez une plage de dates valide.'; return; }
        try {
          const q = await API.post('/bookings/quote', { item_id: item.id, start_date: s, end_date: e });
          qb.innerHTML = `
            <div class="invoice-line"><span>${q.days} j × ${money(q.price_day)}</span><span>${money(q.subtotal)}</span></div>
            <div class="invoice-line"><span>Frais de service (10 %)</span><span>${money(q.service_fee)}</span></div>
            <div class="invoice-line"><span>Dépôt (remboursable)</span><span>${money(q.deposit)}</span></div>
            <div class="invoice-total" style="font-size:16px"><span>Total</span><span>${money(q.total)}</span></div>`;
        } catch (err) { qb.textContent = err.message; }
      };
      $('#bStart').onchange = () => { $('#bEnd').min = $('#bStart').value; recalc(); };
      $('#bEnd').onchange = recalc;
      $('#bookBtn').onclick = async () => {
        const s = $('#bStart').value, e = $('#bEnd').value;
        if (!s || !e || e <= s) return toast('Choisissez des dates valides.', 'err');
        try {
          await API.post('/bookings', { item_id: item.id, start_date: s, end_date: e, message: $('#bMsg').value });
          toast('Demande envoyée ! Suivez-la dans votre tableau de bord.', 'ok');
          location.hash = '#/dashboard?tab=renting';
        } catch (err) { toast(err.message, 'err'); }
      };
    }
  }

  function reviewHTML(r) {
    return `<div class="panel" style="padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between">
        <strong>${esc(r.author)}</strong><span class="stars">${starRow(r.rating)}</span>
      </div>
      ${r.comment ? `<p style="margin:6px 0 0">${esc(r.comment)}</p>` : ''}
      <div class="muted" style="font-size:12px;margin-top:4px">${fmtDate(r.created_at)}</div>
    </div>`;
  }

  // ---------- Vue : connexion / inscription ----------
  function viewAuth(mode) {
    if (API.isLoggedIn()) { location.hash = '#/dashboard'; return; }
    const isLogin = mode === 'login';
    app.innerHTML = `
      <div class="container">
        <div class="panel form-narrow">
          <h1 style="margin:0 0 4px;font-size:24px">${isLogin ? 'Bon retour !' : 'Créez votre compte'}</h1>
          <p class="muted" style="margin:0 0 20px">${isLogin ? 'Connectez-vous pour louer ou gérer vos biens.' : 'Un seul compte pour louer ET proposer vos objets.'}</p>
          <form id="authForm">
            ${isLogin ? '' : `
              <div class="field"><label>Nom complet</label><input name="name" required placeholder="Jean Tremblay"></div>
              <div class="field-row">
                <div class="field"><label>Téléphone</label><input name="phone" placeholder="(optionnel)"></div>
                <div class="field"><label>Ville</label><input name="city" placeholder="(optionnel)"></div>
              </div>`}
            <div class="field"><label>Courriel</label><input name="email" type="email" required placeholder="vous@exemple.com"></div>
            <div class="field"><label>Mot de passe</label><input name="password" type="password" required minlength="6" placeholder="Au moins 6 caractères"></div>
            <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Se connecter' : "S'inscrire"}</button>
          </form>
          <p class="center muted" style="margin:16px 0 0;font-size:14px">
            ${isLogin ? "Pas encore de compte ? <a href='#/register'>Inscrivez-vous</a>" : "Déjà inscrit ? <a href='#/login'>Connectez-vous</a>"}
          </p>
        </div>
      </div>`;

    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(e.target));
      try {
        const r = await API.post(isLogin ? '/auth/login' : '/auth/register', data);
        API.setSession(r.token, r.user);
        toast(isLogin ? 'Connexion réussie !' : 'Bienvenue sur iRent !', 'ok');
        renderNav();
        location.hash = '#/dashboard';
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    };
  }

  // ---------- Vue : tableau de bord ----------
  async function viewDashboard(query) {
    const u = API.user();
    const tab = query.tab || 'renting';
    app.innerHTML = `
      <div class="container">
        <div class="page-head">
          <div><h1>Bonjour, ${esc(u.name.split(' ')[0])} 👋</h1><p>Gérez vos locations et vos biens en un seul endroit.</p></div>
        </div>
        <div id="stats" class="stats"></div>
        <div class="tabs">
          <div class="tab ${tab === 'renting' ? 'active' : ''}" data-tab="renting">🎒 Mes locations</div>
          <div class="tab ${tab === 'received' ? 'active' : ''}" data-tab="received">📥 Demandes reçues</div>
          <div class="tab ${tab === 'items' ? 'active' : ''}" data-tab="items">📦 Mes biens</div>
          <div class="tab ${tab === 'new' ? 'active' : ''}" data-tab="new">➕ Publier</div>
        </div>
        <div id="tabContent"><div class="spinner">Chargement…</div></div>
      </div>`;

    document.querySelectorAll('.tab').forEach(t => t.onclick = () => { location.hash = '#/dashboard?tab=' + t.dataset.tab; });

    loadStats();
    if (tab === 'renting') tabRenting();
    else if (tab === 'received') tabReceived();
    else if (tab === 'items') tabItems();
    else if (tab === 'new') tabNewItem();
  }

  async function loadStats() {
    try {
      const [{ bookings: renting }, { bookings: received }, { items }] = await Promise.all([
        API.get('/bookings/renting'), API.get('/bookings/received'), API.get('/items/mine/list'),
      ]);
      const revenue = received.filter(b => ['confirmee', 'en_cours', 'terminee'].includes(b.status))
        .reduce((s, b) => s + (b.days * b.price_day + b.service_fee), 0);
      const pending = received.filter(b => b.status === 'en_attente').length;
      $('#stats').innerHTML = `
        <div class="stat"><div class="val">${items.length}</div><div class="lab">Biens publiés</div></div>
        <div class="stat"><div class="val">${renting.length}</div><div class="lab">Mes locations</div></div>
        <div class="stat"><div class="val">${pending}</div><div class="lab">Demandes en attente</div></div>
        <div class="stat"><div class="val">${money(revenue)}</div><div class="lab">Revenus (confirmés)</div></div>`;
    } catch { /* silencieux */ }
  }

  async function tabRenting() {
    const c = $('#tabContent');
    const { bookings } = await API.get('/bookings/renting');
    if (!bookings.length) {
      c.innerHTML = emptyState('🎒', 'Vous n\'avez pas encore de location.', 'Parcourez le catalogue pour trouver votre bonheur.', 'Explorer le catalogue', '#/');
      return;
    }
    c.innerHTML = bookings.map(b => bookingRowHTML(b, 'renter')).join('');
    wireBookingRows(c, 'renter');
  }

  async function tabReceived() {
    const c = $('#tabContent');
    const { bookings } = await API.get('/bookings/received');
    if (!bookings.length) {
      c.innerHTML = emptyState('📥', 'Aucune demande pour l\'instant.', 'Publiez des biens pour commencer à recevoir des demandes de location.');
      return;
    }
    c.innerHTML = bookings.map(b => bookingRowHTML(b, 'owner')).join('');
    wireBookingRows(c, 'owner');
  }

  async function tabItems() {
    const c = $('#tabContent');
    const { items } = await API.get('/items/mine/list');
    if (!items.length) {
      c.innerHTML = emptyState('📦', 'Vous n\'avez publié aucun bien.', 'Mettez vos objets en location et générez des revenus.', 'Publier un bien', '#/dashboard?tab=new');
      return;
    }
    c.innerHTML = items.map(it => `
      <div class="row-item">
        <div class="row-thumb">${it.image_url ? `<img src="${esc(it.image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.replaceWith(document.createTextNode('${iconFor(it.category)}'))">` : iconFor(it.category)}</div>
        <div class="row-main">
          <div class="t">${esc(it.title)} ${it.active ? '' : '<span class="badge annulee">Inactif</span>'}</div>
          <div class="s">${iconFor(it.category)} ${esc(it.category)} · ${money(it.price_day)}/jour · 📍 ${esc(it.city || 'N/D')} · ${stars(it.rating_avg, it.rating_count)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-view="${it.id}">Voir</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${it.id}" data-active="${it.active ? 1 : 0}">${it.active ? 'Désactiver' : 'Activer'}</button>
          <button class="btn btn-danger btn-sm" data-del="${it.id}">Supprimer</button>
        </div>
      </div>`).join('');

    c.querySelectorAll('[data-view]').forEach(b => b.onclick = () => location.hash = '#/item/' + b.dataset.view);
    c.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
      try { await API.put('/items/' + b.dataset.toggle, { active: b.dataset.active === '1' ? 0 : 1 }); toast('Bien mis à jour.', 'ok'); tabItems(); }
      catch (err) { toast(err.message, 'err'); }
    });
    c.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Supprimer définitivement ce bien ?')) return;
      try { await API.del('/items/' + b.dataset.del); toast('Bien supprimé.', 'ok'); tabItems(); loadStats(); }
      catch (err) { toast(err.message, 'err'); }
    });
  }

  function tabNewItem() {
    const c = $('#tabContent');
    c.innerHTML = `
      <div class="panel form-narrow">
        <div class="section-title" style="margin-top:0">Publier un nouveau bien</div>
        <form id="itemForm">
          <div class="field"><label>Titre *</label><input name="title" required placeholder="Ex. Perceuse sans-fil DeWalt 20V"></div>
          <div class="field"><label>Catégorie *</label>
            <select name="category" required>${CATEGORIES.map(c => `<option value="${c}">${iconFor(c)} ${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Description</label><textarea name="description" placeholder="État, accessoires inclus, conditions…"></textarea></div>
          <div class="field-row">
            <div class="field"><label>Prix / jour ($) *</label><input name="price_day" type="number" step="0.01" min="0.01" required placeholder="25.00"></div>
            <div class="field"><label>Dépôt de garantie ($)</label><input name="deposit" type="number" step="0.01" min="0" value="0"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Ville</label><input name="city" placeholder="Montréal"></div>
            <div class="field"><label>Lien d'une photo (URL)</label><input name="image_url" placeholder="https://…"></div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Publier le bien</button>
        </form>
      </div>`;
    $('#itemForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      const data = Object.fromEntries(new FormData(e.target));
      try {
        await API.post('/items', data);
        toast('Bien publié avec succès !', 'ok');
        location.hash = '#/dashboard?tab=items';
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
    };
  }

  function emptyState(ico, title, sub, btnLabel, btnHref) {
    return `<div class="empty"><div class="ico">${ico}</div><strong style="font-size:16px;color:var(--ink)">${title}</strong><br><span>${sub}</span>${btnLabel ? `<br><br><a href="${btnHref}" class="btn btn-primary">${btnLabel}</a>` : ''}</div>`;
  }

  function bookingRowHTML(b, role) {
    const thumb = b.item_image
      ? `<img src="${esc(b.item_image)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.replaceWith(document.createTextNode('📦'))">`
      : '📦';
    const who = role === 'owner' ? `Locataire : ${esc(b.renter_name)}` : `Propriétaire : ${esc(b.owner_name)}`;
    return `
      <div class="row-item" data-booking="${b.id}">
        <div class="row-thumb">${thumb}</div>
        <div class="row-main">
          <div class="t">${esc(b.item_title)} <span class="badge ${b.status}">${STATUS_LABEL[b.status]}</span></div>
          <div class="s">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · ${b.days} j · <strong>${money(b.total)}</strong></div>
          <div class="s">${who}</div>
        </div>
        <div class="row-actions" data-actions="${b.id}"></div>
      </div>`;
  }

  function wireBookingRows(root, role) {
    root.querySelectorAll('[data-actions]').forEach(box => {
      const id = box.dataset.actions;
      const row = root.querySelector(`[data-booking="${id}"]`);
      const status = row.querySelector('.badge').classList[1];
      const actions = [`<button class="btn btn-ghost btn-sm" data-invoice="${id}">🧾 Facture</button>`];

      if (role === 'owner') {
        if (status === 'en_attente') actions.push(`<button class="btn btn-primary btn-sm" data-status="${id}:confirmee">Confirmer</button>`, `<button class="btn btn-danger btn-sm" data-status="${id}:annulee">Refuser</button>`);
        if (status === 'confirmee') actions.push(`<button class="btn btn-primary btn-sm" data-status="${id}:en_cours">Marquer remis</button>`);
        if (status === 'en_cours') actions.push(`<button class="btn btn-primary btn-sm" data-status="${id}:terminee">Clôturer</button>`);
      } else {
        if (status === 'en_attente') actions.push(`<button class="btn btn-danger btn-sm" data-status="${id}:annulee">Annuler</button>`);
        if (status === 'terminee') actions.push(`<button class="btn btn-primary btn-sm" data-review="${id}">★ Évaluer</button>`);
      }
      box.innerHTML = actions.join('');
    });

    root.querySelectorAll('[data-status]').forEach(btn => btn.onclick = async () => {
      const [id, status] = btn.dataset.status.split(':');
      try { await API.patch(`/bookings/${id}/status`, { status }); toast('Réservation mise à jour.', 'ok'); router(); }
      catch (err) { toast(err.message, 'err'); }
    });
    root.querySelectorAll('[data-invoice]').forEach(btn => btn.onclick = () => showInvoice(btn.dataset.invoice));
    root.querySelectorAll('[data-review]').forEach(btn => btn.onclick = () => showReviewForm(btn.dataset.review));
  }

  async function showInvoice(id) {
    try {
      const { invoice: inv } = await API.get(`/bookings/${id}/invoice`);
      openModal(`Facture ${inv.number}`, `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div><div class="muted" style="font-size:12px">FACTURÉ À</div><strong>${esc(inv.renter.name)}</strong><br><span class="muted">${esc(inv.renter.email)}</span></div>
          <div style="text-align:right"><div class="muted" style="font-size:12px">PROPRIÉTAIRE</div><strong>${esc(inv.owner.name)}</strong><br><span class="muted">${esc(inv.owner.email)}</span></div>
        </div>
        <div class="panel" style="padding:14px 16px;margin-bottom:16px">
          <strong>${esc(inv.item)}</strong><br>
          <span class="muted">${fmtDate(inv.period.start)} → ${fmtDate(inv.period.end)} (${inv.period.days} jours)</span>
          <span class="badge ${inv.status}" style="float:right">${STATUS_LABEL[inv.status]}</span>
        </div>
        ${inv.lines.map(l => `<div class="invoice-line"><span>${esc(l.label)}</span><span>${money(l.amount)}</span></div>`).join('')}
        <div class="invoice-total"><span>Total</span><span>${money(inv.total)}</span></div>
        <p class="muted" style="font-size:12px;margin-top:16px">Facture no ${inv.number} · émise le ${fmtDate(inv.date)} · iRent</p>
      `);
    } catch (err) { toast(err.message, 'err'); }
  }

  function showReviewForm(id) {
    let rating = 0;
    openModal('Évaluer cette location', `
      <p class="muted" style="margin-top:0">Comment s'est passée votre expérience ?</p>
      <div class="rating-input" id="ratingInput">${[1,2,3,4,5].map(n => `<span data-n="${n}">★</span>`).join('')}</div>
      <div class="field" style="margin-top:16px"><label>Commentaire (optionnel)</label><textarea id="revComment" placeholder="Partagez votre avis…"></textarea></div>
      <button class="btn btn-primary btn-block" id="revSubmit">Envoyer mon avis</button>
    `, ({ close }) => {
      const spans = modalRoot.querySelectorAll('#ratingInput span');
      spans.forEach(s => s.onclick = () => {
        rating = Number(s.dataset.n);
        spans.forEach(x => x.classList.toggle('on', Number(x.dataset.n) <= rating));
      });
      $('#revSubmit').onclick = async () => {
        if (!rating) return toast('Choisissez une note.', 'err');
        try {
          await API.post(`/bookings/${id}/review`, { rating, comment: $('#revComment').value });
          toast('Merci pour votre avis !', 'ok'); close(); router();
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  }

  // ---------- Démarrage ----------
  window.addEventListener('hashchange', router);
  renderNav();
  router();
})();

// Routes des biens à louer : catalogue public + gestion par le propriétaire
import { Router } from 'express';
import db from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

// Enrichit un bien avec le nom du propriétaire et sa note moyenne
function decorate(item) {
  const owner = db.prepare('SELECT name, city FROM users WHERE id = ?').get(item.owner_id);
  const agg = db.prepare(
    'SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE item_id = ?'
  ).get(item.id);
  return {
    ...item,
    active: !!item.active,
    owner_name: owner ? owner.name : 'Inconnu',
    rating_count: agg.n,
    rating_avg: agg.avg ? Math.round(agg.avg * 10) / 10 : null,
  };
}

// Catalogue public : recherche + filtres
router.get('/', (req, res) => {
  const { q, category, city, max_price } = req.query;
  let sql = 'SELECT * FROM items WHERE active = 1';
  const params = [];
  if (q) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (city) { sql += ' AND city LIKE ?'; params.push(`%${city}%`); }
  if (max_price) { sql += ' AND price_day <= ?'; params.push(Number(max_price)); }
  sql += ' ORDER BY created_at DESC';
  const items = db.prepare(sql).all(...params).map(decorate);
  res.json({ items });
});

// Liste des catégories distinctes (pour les filtres)
router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM items WHERE active = 1 ORDER BY category').all();
  res.json({ categories: rows.map(r => r.category) });
});

// Détail d'un bien + avis
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Bien introuvable.' });
  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name AS author
    FROM reviews r JOIN users u ON u.id = r.author_id
    WHERE r.item_id = ? ORDER BY r.created_at DESC
  `).all(item.id);
  res.json({ item: decorate(item), reviews });
});

// Publier un bien (propriétaire)
router.post('/', requireAuth, (req, res) => {
  const { title, description, category, price_day, deposit, city, image_url } = req.body || {};
  if (!title || !category || price_day == null) {
    return res.status(400).json({ error: 'Titre, catégorie et prix par jour sont requis.' });
  }
  if (Number(price_day) <= 0) return res.status(400).json({ error: 'Le prix par jour doit être positif.' });
  const info = db.prepare(`
    INSERT INTO items (owner_id, title, description, category, price_day, deposit, city, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, title.trim(), description || null, category.trim(),
    Number(price_day), Number(deposit) || 0, city || null, image_url || null
  );
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: decorate(item) });
});

// Mes biens (propriétaire)
router.get('/mine/list', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM items WHERE owner_id = ? ORDER BY created_at DESC')
    .all(req.user.id).map(decorate);
  res.json({ items });
});

// Modifier un bien
router.put('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Bien introuvable.' });
  if (item.owner_id !== req.user.id) return res.status(403).json({ error: 'Action non autorisée.' });
  const { title, description, category, price_day, deposit, city, image_url, active } = req.body || {};
  db.prepare(`
    UPDATE items SET title = ?, description = ?, category = ?, price_day = ?, deposit = ?,
      city = ?, image_url = ?, active = ? WHERE id = ?
  `).run(
    title ?? item.title, description ?? item.description, category ?? item.category,
    price_day ?? item.price_day, deposit ?? item.deposit, city ?? item.city,
    image_url ?? item.image_url, active == null ? item.active : (active ? 1 : 0), item.id
  );
  res.json({ item: decorate(db.prepare('SELECT * FROM items WHERE id = ?').get(item.id)) });
});

// Supprimer un bien
router.delete('/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Bien introuvable.' });
  if (item.owner_id !== req.user.id) return res.status(403).json({ error: 'Action non autorisée.' });
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

export default router;

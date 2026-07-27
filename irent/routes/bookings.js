// Routes des réservations : création, facturation, suivi de statut, avis
import { Router } from 'express';
import db from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

const SERVICE_FEE_RATE = 0.10; // 10 % de frais de service iRent
const MS_DAY = 24 * 60 * 60 * 1000;

// Statuts valides et transitions autorisées
const FLOW = {
  en_attente: ['confirmee', 'annulee'],
  confirmee: ['en_cours', 'annulee'],
  en_cours: ['terminee'],
  terminee: [],
  annulee: [],
};

function daysBetween(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.round((e - s) / MS_DAY);
}

function decorateBooking(b) {
  const item = db.prepare('SELECT title, image_url, city FROM items WHERE id = ?').get(b.item_id);
  const renter = db.prepare('SELECT name FROM users WHERE id = ?').get(b.renter_id);
  const owner = db.prepare('SELECT u.name FROM items i JOIN users u ON u.id = i.owner_id WHERE i.id = ?').get(b.item_id);
  return {
    ...b,
    item_title: item ? item.title : 'Bien supprimé',
    item_image: item ? item.image_url : null,
    item_city: item ? item.city : null,
    renter_name: renter ? renter.name : 'Inconnu',
    owner_name: owner ? owner.name : 'Inconnu',
  };
}

// Devis : calcule le coût sans réserver (utilisé par le formulaire)
router.post('/quote', (req, res) => {
  const { item_id, start_date, end_date } = req.body || {};
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Bien introuvable.' });
  const days = daysBetween(start_date, end_date);
  if (!days || days < 1) return res.status(400).json({ error: 'Les dates choisies sont invalides.' });
  const subtotal = days * item.price_day;
  const service_fee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  res.json({
    days, price_day: item.price_day, subtotal, service_fee,
    deposit: item.deposit, total: subtotal + service_fee + item.deposit,
  });
});

// Créer une réservation (locataire)
router.post('/', requireAuth, (req, res) => {
  const { item_id, start_date, end_date, message } = req.body || {};
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND active = 1').get(item_id);
  if (!item) return res.status(404).json({ error: 'Bien introuvable ou indisponible.' });
  if (item.owner_id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas louer votre propre bien.' });
  }
  const days = daysBetween(start_date, end_date);
  if (!days || days < 1) return res.status(400).json({ error: 'Les dates choisies sont invalides.' });

  // Vérifie qu'aucune réservation active ne chevauche ces dates
  const clash = db.prepare(`
    SELECT id FROM bookings
    WHERE item_id = ? AND status IN ('en_attente','confirmee','en_cours')
      AND NOT (end_date <= ? OR start_date >= ?)
  `).get(item_id, start_date, end_date);
  if (clash) return res.status(409).json({ error: 'Ce bien est déjà réservé pour ces dates.' });

  const subtotal = days * item.price_day;
  const service_fee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;
  const total = subtotal + service_fee + item.deposit;

  const info = db.prepare(`
    INSERT INTO bookings (item_id, renter_id, start_date, end_date, days, price_day, deposit, service_fee, total, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item_id, req.user.id, start_date, end_date, days, item.price_day, item.deposit, service_fee, total, message || null);

  res.status(201).json({ booking: decorateBooking(db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid)) });
});

// Mes locations (en tant que locataire)
router.get('/renting', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings WHERE renter_id = ? ORDER BY created_at DESC')
    .all(req.user.id).map(decorateBooking);
  res.json({ bookings: rows });
});

// Les demandes reçues sur mes biens (en tant que propriétaire)
router.get('/received', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT b.* FROM bookings b JOIN items i ON i.id = b.item_id
    WHERE i.owner_id = ? ORDER BY b.created_at DESC
  `).all(req.user.id).map(decorateBooking);
  res.json({ bookings: rows });
});

// Facture d'une réservation (accessible au locataire et au propriétaire)
router.get('/:id/invoice', requireAuth, (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Réservation introuvable.' });
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(b.item_id);
  const isOwner = item && item.owner_id === req.user.id;
  if (b.renter_id !== req.user.id && !isOwner) return res.status(403).json({ error: 'Action non autorisée.' });
  const renter = db.prepare('SELECT name, email FROM users WHERE id = ?').get(b.renter_id);
  const owner = db.prepare('SELECT name, email FROM users WHERE id = ?').get(item.owner_id);
  res.json({
    invoice: {
      number: 'IR-' + String(b.id).padStart(6, '0'),
      date: b.created_at,
      status: b.status,
      item: item.title,
      renter, owner,
      period: { start: b.start_date, end: b.end_date, days: b.days },
      lines: [
        { label: `Location (${b.days} j × ${b.price_day.toFixed(2)} $)`, amount: b.days * b.price_day },
        { label: 'Frais de service iRent (10 %)', amount: b.service_fee },
        { label: 'Dépôt de garantie (remboursable)', amount: b.deposit },
      ],
      total: b.total,
    },
  });
});

// Changer le statut d'une réservation
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Réservation introuvable.' });
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(b.item_id);
  const isOwner = item && item.owner_id === req.user.id;
  const isRenter = b.renter_id === req.user.id;
  if (!isOwner && !isRenter) return res.status(403).json({ error: 'Action non autorisée.' });

  if (!FLOW[b.status] || !FLOW[b.status].includes(status)) {
    return res.status(400).json({ error: `Transition « ${b.status} → ${status} » non permise.` });
  }
  // Le propriétaire confirme/démarre/termine ; les deux peuvent annuler une demande en attente.
  if (status === 'annulee') {
    if (!(isOwner || isRenter)) return res.status(403).json({ error: 'Action non autorisée.' });
  } else if (!isOwner) {
    return res.status(403).json({ error: 'Seul le propriétaire peut faire évoluer cette réservation.' });
  }

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, b.id);
  res.json({ booking: decorateBooking(db.prepare('SELECT * FROM bookings WHERE id = ?').get(b.id)) });
});

// Laisser un avis (locataire, après une location terminée)
router.post('/:id/review', requireAuth, (req, res) => {
  const { rating, comment } = req.body || {};
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Réservation introuvable.' });
  if (b.renter_id !== req.user.id) return res.status(403).json({ error: 'Seul le locataire peut évaluer.' });
  if (b.status !== 'terminee') return res.status(400).json({ error: 'On ne peut évaluer qu\'une location terminée.' });
  const existing = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(b.id);
  if (existing) return res.status(409).json({ error: 'Vous avez déjà évalué cette location.' });
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) return res.status(400).json({ error: 'La note doit être entre 1 et 5.' });
  db.prepare('INSERT INTO reviews (booking_id, item_id, author_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(b.id, b.item_id, req.user.id, r, comment || null);
  res.status(201).json({ ok: true });
});

export default router;

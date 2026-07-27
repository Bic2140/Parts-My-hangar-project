// Routes d'authentification : inscription, connexion, profil
import { Router } from 'express';
import db from '../lib/db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../lib/auth.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, city: u.city };
}

// Inscription
router.post('/register', (req, res) => {
  const { name, email, password, phone, city } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, courriel et mot de passe sont requis.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit avoir au moins 6 caractères.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'Ce courriel est déjà utilisé.' });

  const info = db.prepare(
    'INSERT INTO users (name, email, password, phone, city) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), String(email).toLowerCase().trim(), hashPassword(password), phone || null, city || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// Connexion
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Courriel et mot de passe requis.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Courriel ou mot de passe incorrect.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Profil courant
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ user: publicUser(user) });
});

export default router;

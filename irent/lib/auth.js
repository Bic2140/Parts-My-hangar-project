// Authentification : hachage de mot de passe, jetons JWT, middleware
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.IRENT_SECRET || 'irent-dev-secret-change-me';
const EXPIRES = '7d';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: EXPIRES });
}

// Middleware : exige un jeton valide, sinon 401
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

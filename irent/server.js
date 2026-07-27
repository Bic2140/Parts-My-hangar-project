// Serveur iRent — plateforme de location d'objets entre particuliers
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import bookingRoutes from './routes/bookings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/bookings', bookingRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'iRent' }));

// Fichiers statiques (interface)
app.use(express.static(path.join(__dirname, 'public')));

// Repli SPA : toute autre route renvoie l'application
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`iRent démarré sur http://localhost:${PORT}`);
});

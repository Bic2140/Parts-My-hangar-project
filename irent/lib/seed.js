// Remplit la base avec des comptes et des biens de démonstration.
// Usage : npm run seed
import db from './db.js';
import { hashPassword } from './auth.js';

console.log('Réinitialisation des données de démonstration…');
db.exec('DELETE FROM reviews; DELETE FROM bookings; DELETE FROM items; DELETE FROM users;');

const users = [
  { name: 'Jean Tremblay', email: 'jean@irent.ca', city: 'Montréal', phone: '514-555-0101' },
  { name: 'Marie Gagnon', email: 'marie@irent.ca', city: 'Québec', phone: '418-555-0102' },
  { name: 'Luc Bélanger', email: 'luc@irent.ca', city: 'Laval', phone: '450-555-0103' },
  { name: 'Sophie Roy', email: 'sophie@irent.ca', city: 'Gatineau', phone: '819-555-0104' },
];
const ins = db.prepare('INSERT INTO users (name, email, password, phone, city) VALUES (?, ?, ?, ?, ?)');
const ids = users.map(u => ins.run(u.name, u.email, hashPassword('motdepasse'), u.phone, u.city).lastInsertRowid);

const items = [
  { o: 0, title: 'Perceuse sans-fil DeWalt 20V', cat: 'Outils', price: 18, dep: 60, city: 'Montréal', img: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600', desc: 'Perceuse-visseuse robuste avec 2 batteries, chargeur et mallette. Idéale pour vos projets de rénovation.' },
  { o: 1, title: 'Tondeuse à gazon autotractée', cat: 'Jardinage', price: 30, dep: 100, city: 'Québec', img: 'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?w=600', desc: 'Tondeuse essence 21 pouces, autotractée. Parfaite pour les grands terrains. Entretenue chaque saison.' },
  { o: 0, title: 'Remorque utilitaire 5x8', cat: 'Automobile', price: 45, dep: 200, city: 'Montréal', img: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600', desc: 'Remorque ouverte, ridelles rabattables. Attelage 2 pouces. Idéale pour déménagements et transport.' },
  { o: 2, title: 'Scie circulaire Makita', cat: 'Construction', price: 15, dep: 50, city: 'Laval', img: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600', desc: 'Scie circulaire 7 1/4 pouces, lame neuve. Coupe précise, guide laser inclus.' },
  { o: 3, title: 'Nettoyeur haute pression 2000 PSI', cat: 'Nettoyage', price: 22, dep: 80, city: 'Gatineau', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', desc: 'Laveuse à pression électrique, plusieurs buses. Nettoie patios, entrées et véhicules.' },
  { o: 1, title: 'Vélo de montagne (taille M)', cat: 'Sport & Plein air', price: 25, dep: 120, city: 'Québec', img: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=600', desc: 'VTT à suspension avant, 21 vitesses. Bien entretenu, casque fourni.' },
  { o: 2, title: 'Tente de réception 3x6 m', cat: 'Événementiel', price: 60, dep: 150, city: 'Laval', img: 'https://images.unsplash.com/photo-1478827387698-1527781a4887?w=600', desc: 'Chapiteau blanc pour mariages, fêtes et événements. Montage facile, sac de transport inclus.' },
  { o: 3, title: 'Échafaudage roulant 4 sections', cat: 'Construction', price: 35, dep: 130, city: 'Gatineau', img: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600', desc: 'Échafaudage sur roulettes, hauteur ajustable jusqu\'à 6 m. Sécuritaire et stable.' },
  { o: 0, title: 'Souffleuse à neige 24 pouces', cat: 'Jardinage', price: 40, dep: 150, city: 'Montréal', img: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=600', desc: 'Souffleuse deux étages, démarrage électrique. Prête pour l\'hiver québécois.' },
  { o: 1, title: 'Projecteur home cinéma 4K', cat: 'Électronique', price: 28, dep: 90, city: 'Québec', img: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600', desc: 'Projecteur 4K avec écran portable 100 pouces. Soirée cinéma ou présentation.' },
];

const insItem = db.prepare(`INSERT INTO items (owner_id, title, description, category, price_day, deposit, city, image_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const itemIds = items.map(i => insItem.run(ids[i.o], i.title, i.desc, i.cat, i.price, i.dep, i.city, i.img).lastInsertRowid);

// Une réservation terminée + avis, pour la démonstration
const b = db.prepare(`INSERT INTO bookings (item_id, renter_id, start_date, end_date, days, price_day, deposit, service_fee, total, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'terminee')`)
  .run(itemIds[0], ids[1], '2026-06-01', '2026-06-04', 3, 18, 60, 5.4, 119.4);
db.prepare('INSERT INTO reviews (booking_id, item_id, author_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
  .run(b.lastInsertRowid, itemIds[0], ids[1], 5, 'Perceuse impeccable, propriétaire très aimable. Je recommande !');

console.log(`✓ ${users.length} comptes, ${items.length} biens, 1 location + avis créés.`);
console.log('  Connexion démo : jean@irent.ca / motdepasse');

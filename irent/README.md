# iRent 🔑

**Plateforme de location d'objets entre particuliers** — dans l'esprit d'Airbnb, mais pour les outils, l'équipement et les objets du quotidien (tondeuses, perceuses, remorques, etc.).

Les **propriétaires** publient les biens qu'ils possèdent, et les **locataires** parcourent le catalogue et réservent pour les dates de leur choix. Un même compte peut faire les deux. iRent calcule automatiquement la facture (location + frais de service + dépôt de garantie) et suit chaque réservation de la demande jusqu'à la clôture.

## Fonctionnalités

- 🔐 **Comptes & connexion** — inscription, connexion sécurisée (mots de passe hachés bcrypt, sessions par jeton JWT). Un seul compte pour louer **et** proposer.
- 🛍️ **Catalogue** — recherche par mot-clé, filtres par catégorie, ville et prix maximum.
- 📦 **Gestion des biens** — publier, modifier, activer/désactiver, supprimer ses biens.
- 📅 **Réservations** — choix des dates, devis instantané, détection des conflits de disponibilité.
- 🧾 **Facturation automatique** — calcul du sous-total, des frais de service (10 %) et du dépôt ; facture consultable et imprimable.
- 🔄 **Suivi de statut** — `en attente → confirmée → en cours → terminée` (ou `annulée`), avec les bonnes permissions pour le propriétaire et le locataire.
- ⭐ **Avis & notes** — le locataire évalue après une location terminée ; la note moyenne s'affiche sur chaque bien.
- 📊 **Tableau de bord** — mes locations, demandes reçues, mes biens, revenus confirmés.

## Stack technique

- **Backend** : Node.js + Express (API REST)
- **Base de données** : SQLite (via `better-sqlite3`) — un simple fichier, aucune configuration
- **Auth** : `bcryptjs` + `jsonwebtoken`
- **Frontend** : HTML/CSS/JS pur (application monopage, aucune étape de build)

## Démarrage

```bash
cd irent
npm install
npm run seed     # (optionnel) remplit des comptes et des biens de démonstration
npm start        # démarre sur http://localhost:3000
```

Puis ouvrez **http://localhost:3000**.

### Comptes de démonstration (après `npm run seed`)

| Courriel          | Mot de passe |
|-------------------|--------------|
| `jean@irent.ca`   | `motdepasse` |
| `marie@irent.ca`  | `motdepasse` |
| `luc@irent.ca`    | `motdepasse` |
| `sophie@irent.ca` | `motdepasse` |

## Structure

```
irent/
├── server.js            # Serveur Express + service des fichiers statiques
├── lib/
│   ├── db.js            # Connexion SQLite + schéma
│   ├── auth.js          # Hachage, JWT, middleware d'authentification
│   └── seed.js          # Données de démonstration
├── routes/
│   ├── auth.js          # /api/auth  (inscription, connexion, profil)
│   ├── items.js         # /api/items (catalogue, gestion des biens)
│   └── bookings.js      # /api/bookings (réservations, devis, factures, avis)
└── public/
    ├── index.html
    ├── css/styles.css
    └── js/{api.js, app.js}
```

## Variables d'environnement

| Variable        | Défaut                       | Rôle                                   |
|-----------------|------------------------------|----------------------------------------|
| `PORT`          | `3000`                       | Port du serveur                        |
| `IRENT_SECRET`  | `irent-dev-secret-change-me` | Clé de signature des jetons JWT        |
| `IRENT_DB`      | `./irent.db`                 | Emplacement du fichier de base SQLite  |

> ⚠️ En production, définissez impérativement `IRENT_SECRET` avec une valeur forte et secrète.

## Pistes d'évolution

- Paiement réel (Stripe) et versement aux propriétaires
- Téléversement de photos (plutôt qu'une URL)
- Messagerie entre locataire et propriétaire
- Notifications par courriel
- Calendrier de disponibilité visuel
- Application mobile

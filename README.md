# HelpTruth — Twitter-klon v2

Fullstack Twitter-kopi med Node.js backend og React frontend.
10 features: bildeopplasting, direktemeldinger, sanntids-feed, varsler, profilbilde, hashtags, sitatinnlegg, tråder, polls og backend-søk.

---

## Prosjektstruktur

```
helptruth/
├── render.yaml              ← Render deploy-config (backend + database)
├── DEPLOY.md                ← Steg-for-steg deploy-guide
├── backend/
│   ├── db/
│   │   ├── pool.js          ← Database-kobling (DATABASE_URL)
│   │   └── schema.sql       ← Alle tabeller + testdata
│   ├── middleware/
│   │   └── auth.js          ← JWT-verifisering
│   ├── routes/
│   │   ├── auth.js          ← Register/login
│   │   ├── posts.js         ← Feed, innlegg, likes, reposts, polls
│   │   ├── users.js         ← Profiler, følge-system
│   │   ├── messages.js      ← Direktemeldinger
│   │   ├── notifications.js ← Varsler
│   │   ├── upload.js        ← Bildeopplasting (Cloudinary)
│   │   └── search.js        ← Fulltekstsøk
│   ├── server.js            ← Express + Socket.io
│   ├── .env.example
│   └── package.json
└── frontend/
    └── src/
        ├── api.js            ← Alle API-kall
        ├── App.jsx           ← Hele UI-et
        └── index.js
```

---

## Oppsett lokalt

### 1. Database
```bash
# Opprett database
psql -U postgres -c "CREATE DATABASE helptruth;"

# Kjør skjema
psql -U postgres -d helptruth -f backend/db/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # Fyll inn dine verdier
npm install
npm run dev                  # Port 4000
```

### 3. Frontend
```bash
cd frontend
npm install
npm start                    # Port 3000
```

---

## Deploy

- **Backend:** Render (Web Service + PostgreSQL)
- **Frontend:** Vercel

Se `DEPLOY.md` for komplett steg-for-steg guide.

---

## Testbrukere (passord: password123)

| E-post | Handle |
|--------|--------|
| heljar@startfunder.no | @heljar |
| kontakt@startfunder.no | @startfunder |
| post@cryptonorge.no | @cryptonorge |

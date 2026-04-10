# Deploy HelpTruth
## Render (backend + database) + Vercel (frontend)

---

## STEG 1 — Legg koden på GitHub

### Opprett to repositories på github.com:
- `helptruth-backend`
- `helptruth-frontend`

### Last opp backend:
```bash
cd helptruth/backend

git init
git add .
git commit -m "første commit"
git branch -M main
git remote add origin https://github.com/DITT-BRUKERNAVN/helptruth-backend.git
git push -u origin main
```

### Last opp frontend:
```bash
cd helptruth/frontend

git init
git add .
git commit -m "første commit"
git branch -M main
git remote add origin https://github.com/DITT-BRUKERNAVN/helptruth-frontend.git
git push -u origin main
```

---

## STEG 2 — Opprett database på Render

1. Gå til **render.com** og logg inn med GitHub
2. Klikk **"New"** → **"PostgreSQL"**
3. Fyll inn:
   - **Name:** `helptruth-db`
   - **Database:** `helptruth`
   - **User:** `helptruth`
   - **Region:** Frankfurt (EU)
   - **Plan:** Free
4. Klikk **"Create Database"**
5. Vent til statusen er **Available**
6. Kopier **Internal Database URL** (brukes i steg 3)
   - Ser slik ut: `postgresql://helptruth:abc123@dpg-xxx.frankfurt-postgres.render.com/helptruth`
7. Koble til med psql eller Render Shell og kjør `backend/db/schema.sql`:
```bash
psql "DIN_DATABASE_URL" -f backend/db/schema.sql
```

---

## STEG 3 — Deploy backend på Render

1. I Render, klikk **"New"** → **"Web Service"**
2. Koble til GitHub-repoet **helptruth-backend**
3. Fyll inn:
   - **Name:** `helptruth-backend`
   - **Region:** Frankfurt (EU) — samme som databasen
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

### Sett miljøvariabler:
Klikk **"Environment"** → legg til:

| Variabel | Verdi |
|----------|-------|
| `DATABASE_URL` | (Internal URL fra steg 2) |
| `JWT_SECRET` | (generer med `openssl rand -hex 64`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(sett denne etter steg 4)* |
| `CLOUDINARY_CLOUD_NAME` | (fra Cloudinary dashboard) |
| `CLOUDINARY_API_KEY` | (fra Cloudinary dashboard) |
| `CLOUDINARY_API_SECRET` | (fra Cloudinary dashboard) |

4. Klikk **"Create Web Service"**
5. Vent ~2 minutter → du får en URL som: `https://helptruth-backend.onrender.com`
6. Test: åpne `https://helptruth-backend.onrender.com/api/health`
   - Skal vise: `{"status":"ok","message":"HelpTruth API v2"}`

> **NB:** Render Free-tier spinner ned etter 15 min inaktivitet.
> Første request etter dvale tar ~30 sekunder. Oppgrader til $7/mnd for alltid-på.

---

## STEG 4 — Deploy frontend på Vercel

1. Gå til **vercel.com** og logg inn med GitHub
2. Klikk **"Add New Project"**
3. Velg **helptruth-frontend**
4. Under **"Environment Variables"** legg til:
   - `REACT_APP_API_URL` = `https://helptruth-backend.onrender.com/api`
5. Klikk **"Deploy"**
6. Vent ~2 minutter → du får en URL som: `https://helptruth-frontend.vercel.app`

---

## STEG 5 — Koble backend til frontend (CORS)

1. Gå tilbake til Render → helptruth-backend → **Environment**
2. Oppdater:
   - `FRONTEND_URL` = `https://helptruth-frontend.vercel.app`
3. Klikk **"Save Changes"** — Render restarter automatisk

---

## STEG 6 — Test at alt fungerer

Åpne `https://helptruth-frontend.vercel.app`:

- [ ] Login-siden vises
- [ ] Trykk "Fyll inn demo-bruker" og logg inn
- [ ] Feed laster fra databasen
- [ ] Post et nytt innlegg
- [ ] Like og repost fungerer
- [ ] Meldinger fungerer
- [ ] Varsler vises
- [ ] Logg ut og logg inn igjen

### Testbrukere (passord: password123)
| E-post | Handle |
|--------|--------|
| heljar@startfunder.no | @heljar |
| kontakt@startfunder.no | @startfunder |
| post@cryptonorge.no | @cryptonorge |

---

## Egendefinert domene

### Frontend (Vercel):
1. Prosjektet → **"Domains"** → legg til domene
2. DNS: `CNAME www → cname.vercel-dns.com`

### Backend (Render):
1. Web Service → **"Settings"** → **"Custom Domains"**
2. DNS: `CNAME api.helptruth.no → helptruth-backend.onrender.com`

---

## Feilsøking

**Backend starter ikke:**
- Sjekk Render-logger under **"Logs"**
- Vanlig feil: DATABASE_URL ikke satt eller feil format

**CORS-feil i nettleser:**
- Sjekk at `FRONTEND_URL` i Render matcher Vercel-URL nøyaktig (med https://)

**Login fungerer ikke:**
- Sjekk at `REACT_APP_API_URL` i Vercel peker til riktig Render-URL
- Husk `/api` på slutten

**Databasen er tom:**
- Koble til med psql og kjør schema.sql på nytt

**Backend er treg (cold start):**
- Render Free spinner ned etter 15 min. Første request tar ~30s.
- Oppgrader til Starter ($7/mnd) for alltid-på.

---

## Kostnader

| Tjeneste | Plan | Kostnad |
|----------|------|---------|
| Render PostgreSQL | Free | Gratis (90 dager, deretter $7/mnd) |
| Render Web Service | Free | Gratis (750 timer/mnd) |
| Vercel | Hobby | Gratis |
| Cloudinary | Free | Gratis (25 GB) |
| **Totalt** | | **Gratis** (eller ~$14/mnd etter 90 dager) |

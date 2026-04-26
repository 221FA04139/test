# Finance Manager — Deployment Guide

## Local Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL installed and running

### Steps

**1. Clone / enter the project directory**
```bash
cd "Finance app"
```

**2. Create virtual environment**
```bash
python3 -m venv venv
source venv/bin/activate      # Mac/Linux
# venv\Scripts\activate       # Windows
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Create your .env file**
```bash
cp .env.example .env
```
Then edit `.env`:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/financedb
SECRET_KEY=generate-with-python-c-import-secrets-print-secrets-token-hex-32
FLASK_ENV=development
APP_VERSION=1.0.0
```

**5. Create the local PostgreSQL database**
```bash
psql -U postgres -c "CREATE DATABASE financedb;"
```

**6. Initialise database (creates tables + seeds default user)**
```bash
python init_db.py
```

**7. Start the development server**
```bash
python app.py
```

Visit: http://localhost:5000

**Login credentials:**
- Username: `nayeem`
- Password: `finance2025`

---

## Railway.app Deployment (Production)

### One-time setup

**1. Create a Railway account**
Go to https://railway.app and sign in with GitHub.

**2. Create a new project**
- Click "New Project"
- Choose "Deploy from GitHub repo"
- Select your Finance app repository
- (If not on GitHub yet: push this folder to a new GitHub repo first)

**3. Add PostgreSQL database**
- Inside your Railway project, click "+ New"
- Select "Database" → "PostgreSQL"
- Railway auto-creates the database and sets `DATABASE_URL` in your environment

**4. Set environment variables**
In Railway dashboard → your service → "Variables" tab, add:
```
SECRET_KEY=<generate a strong random key — see below>
APP_VERSION=1.0.0
FLASK_ENV=production
```

To generate a secret key:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**5. Deploy**
- Railway auto-deploys whenever you push to your connected GitHub branch
- The Procfile runs `python init_db.py` before gunicorn — this creates tables and seeds the admin user on first deploy

**6. Get your public URL**
- In Railway dashboard → Deployments tab → click "Generate Domain"
- Your app will be live at `https://yourapp.up.railway.app`

---

## Database Migrations (after schema changes)

When you change `database.py` models in the future:

**Local:**
```bash
source venv/bin/activate
flask db init        # only first time — creates migrations/ folder
flask db migrate -m "describe your change"
flask db upgrade
```

**On Railway:**
- Commit the new `migrations/` folder to git
- Change Procfile to:
  ```
  web: flask db upgrade && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
  ```
- Push to GitHub — Railway will run migrations automatically on each deploy

---

## Pushing to GitHub (first time)

```bash
cd "Finance app"
git init
git add -A
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/finance-app.git
git push -u origin main
```

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `DATABASE_URL not set` | Add it to `.env` (local) or Railway Variables (prod) |
| `psycopg2` install fails | Run `pip install psycopg2-binary` |
| `CSRF token missing` | Ensure `<meta name="csrf-token">` is in HTML — already included |
| Login fails on first run | Run `python init_db.py` to seed the admin user |
| Railway deploy fails | Check the build logs in Railway dashboard → Deployments |
| Port already in use locally | Change port: `PORT=5001 python app.py` |

---

## Default Credentials

| Field | Value |
|-------|-------|
| Username | `nayeem` |
| Password | `finance2025` |

**Change the password immediately after first login** via Settings → Change Password.

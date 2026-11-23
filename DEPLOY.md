# AI-Powered Multi-Vendor E-Commerce — Deployment Guide

> Full-stack platform: React + Vite frontend · Hono + tRPC backend · Supabase PostgreSQL · Local AI features

---

## 🧪 Test Team Credentials

Share these with your QA team **after the app is live**:

| Role | Phone | Password | Notes |
|------|-------|----------|-------|
| **Customer** | Sign up with any phone | Choose at signup | Anyone can register |
| **Seller** | `01700000001` | `seller123` | Pre-seeded demo seller (TechVault Electronics) |
| **Admin** | `01700000006` | `admin123` | Full admin dashboard access |

> The seller and admin demo accounts are **auto-created on first login** — no seeding required.

---

## 🚀 Option A — Railway (Recommended for Quick Testing)

Railway gives you a public app URL. Use a Supabase project for PostgreSQL.

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "chore: production-ready deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Create a Railway project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select your repo
3. Railway auto-detects Node.js and uses `railway.json`

### 3. Create a Supabase database
1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **Project Settings → Database → Connect** and copy a PostgreSQL connection URI.
3. Use a session pooler URI if your app host cannot reach the direct database host.

### 4. Set environment variables
In your Railway web service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(paste the server-side URI from Supabase)* |
| `APP_SECRET` | *(generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `APP_ID` | `ecommerce_prod` |
| `OWNER_UNION_ID` | `local:01700000006` |
| `CORS_ORIGIN` | *(your Railway app URL, e.g. `https://myapp.up.railway.app`)* |

### 5. Deploy
Railway auto-deploys on every push. Visit your Railway URL to open the app.

---

## 🌐 Option B — Render.com (Free Tier Available)

### 1. Push to GitHub (same as Railway step 1)

### 2. Create a Render web service
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/health`

### 3. Configure Supabase PostgreSQL
Create a Supabase project and copy its PostgreSQL connection URI from **Project Settings → Database → Connect**.

### 4. Set environment variables
Set the same environment variables as Railway (see table above), including Supabase's server-side `DATABASE_URL`.

---

## 🖥️ Option C — VPS / Bare Metal (Ubuntu)

### Prerequisites
```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
npm install -g pm2

# Use Supabase for hosted PostgreSQL; no local database installation is required.
```

### Database setup
Set `DATABASE_URL` to the server-side connection URI from Supabase **Project Settings → Database → Connect**. Keep the URI out of browser variables and source control.

### Deploy the app
```bash
# Clone / upload your project
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /var/www/ecommerce
cd /var/www/ecommerce

# Create production .env
cp .env.production.example .env
nano .env   # Fill in DATABASE_URL, APP_SECRET, etc.

# Install and build
npm install --production=false
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # Follow the printed command to auto-start on reboot
```

### Nginx reverse proxy (optional, for custom domain + HTTPS)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable HTTPS with Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | No | Server port (default: `3000`) |
| `DATABASE_URL` | Yes | Supabase server-side PostgreSQL connection URI |
| `APP_SECRET` | Yes | JWT signing secret (32+ random chars) |
| `APP_ID` | No | OAuth app identifier (default: `local_app_id`) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins (default: `*`) |
| `OWNER_UNION_ID` | No | First-login admin user ID |
| `OPENAI_API_KEY` | Yes | OpenAI API Key (powers Seller Copilot V2 & auto-suggest) |
| `SSLCOMMERZ_STORE_ID` | Yes | SSLCommerz Merchant Store ID |
| `SSLCOMMERZ_STORE_PASSWORD` | Yes | SSLCommerz Merchant Store Password |
| `SSLCOMMERZ_IS_LIVE` | No | `true` for live production, `false` for sandbox |

---

## 🔍 Verification

Once deployed, verify these endpoints:

| Check | URL | Expected |
|-------|-----|----------|
| Health | `/health` | `{"status":"ok","db":"connected"}` |
| API ping | `/api/trpc/ping` | `{"result":{"data":{"ok":true}}}` |
| Home page | `/` | React app loads |

---

## 📊 App Features for Testers

### As a Customer
- Browse products, categories, and sellers
- Add items to cart and checkout
- Track orders
- Manage wishlist
- Use AI Fashion Stylist (`/fashion-stylist`)
- Use AI Support Chat (`/support`)

### As a Seller (`/seller`)
- Manage products (add, edit, delete)
- View orders and revenue analytics
- Use AI Seller Assistant for content generation
- Manage store settings and profile

### As an Admin (`/admin`)
- User management (roles, bans)
- Seller approval/rejection
- Category and product management
- Order oversight
- Support analytics dashboard
- AI Ops workspace

---

## 🏗️ Build Info

| What | Detail |
|------|--------|
| Frontend bundle | `dist/public/` (served as static files) |
| Backend bundle | `dist/boot.js` (2.6 MB, includes all server code) |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Node requirement | Node.js 18+ |
| DB requirement | Supabase PostgreSQL |

# MegaTech

An online store for PC components and gaming gear: graphics cards, monitors, laptops and peripherals.

- **Shop:** product catalog with search and filters, cart with a quick mini cart, sign-in before checkout, order tracking, store locations, contact form, and a shop assistant chat.
- **Admin panel:** dashboard, products, categories, stores, orders (status changes email the customer), customer messages, and account settings.
- **Emails:** order confirmations and status updates with product photos.

## Project structure

```
backend/    Node.js + Express API and MySQL database access
  server.js           API routes
  chatbot.js          shop assistant (rule-based, no AI service needed)
  emails.js           order email template
  database/schema.sql database tables (structure only)
  scripts/            one-off maintenance scripts
  images/             uploaded product and store photos (not in git)
frontend/   React app (Create React App)
  src/pages/          one file per page (shop and admin)
  src/Components/     navbar, footer, cart, chat, admin layout, forms
  src/Styles/         stylesheets (theme.css holds the shared colors and building blocks)
  src/utils/shop.js   shared helpers (prices, images, order statuses, low-stock rule)
```

## Requirements

- Node.js 22 or newer
- MySQL (or MariaDB)
- A Gmail account with an [app password](https://support.google.com/accounts/answer/185833) to send emails

## Setup

### 1. Database

```bash
mysql -u root -p < backend/database/schema.sql
```

This creates the `pc_store` database and its tables (empty).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

| Setting | What it is |
|---|---|
| `EMAIL_USER`, `EMAIL_PASS` | Gmail address and app password used to send order emails |
| `JWT_SECRET` | A long random secret. Generate one with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | MySQL connection |
| `SITE_URL` | Address of the website (used for links in emails and allowed to call the API), e.g. `https://megatech.com`. Several addresses can be separated by commas. |
| `GOOGLE_CLIENT_ID` | Optional, for "Continue with Google" (see below) |
| `DELIVERY_FEE` | Delivery fee added to every order, in dollars (default 5) |

Never commit `backend/.env`; it holds your secrets (it's already in `.gitignore`).

Create the first admin account, then hash its password:

```sql
INSERT INTO pc_store.admins (email, password) VALUES ('admin@example.com', 'choose-a-strong-password');
```

```bash
npm run hash-admin-passwords
npm run migrate
npm start
```

`npm run migrate` adds the email-confirmation, Google, payment-method, delivery-fee, extra-photo, specification, saved-address and wishlist tables/columns to an existing database. It is safe to run more than once.

Product photos are cut to the same size and margin (1000×750) when uploaded. To do the same to photos that were added before, run `npm run standardize-images`; the originals are copied to `backend/image-backups/` first.

The API runs on http://localhost:5001.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

The site opens on http://localhost:3000. The backend address is set in `frontend/.env` (`REACT_APP_API_URL`); restart `npm start` after changing it.

### 4. Customer accounts

New customers confirm their email with a 6-digit code before they can sign in or order. Codes expire after 15 minutes and allow 5 tries.

**Continue with Google (optional):**

1. Open https://console.cloud.google.com, create a project, then go to **APIs & Services → OAuth consent screen** and fill in the app name and your email.
2. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized JavaScript origins** add `http://localhost:3000` (and later your real address, e.g. `https://megatech.com`). No redirect URI is needed.
4. Copy the Client ID into `backend/.env` as `GOOGLE_CLIENT_ID` and into `frontend/.env` as `REACT_APP_GOOGLE_CLIENT_ID`.
5. Restart both servers. The Google button appears on the sign-in page; while the ID is empty it stays hidden.

### 5. Visitor statistics (optional)

1. Go to https://analytics.google.com and create an account and a **property** for MegaTech, then a **Web** data stream for your website address.
2. Copy the **Measurement ID** (looks like `G-ABC123XYZ`) into `frontend/.env` as `REACT_APP_GA_ID`, and restart the frontend.

Admin pages are never counted, and the Privacy page then mentions Google Analytics automatically.

## Backups

The database and uploaded photos are not on GitHub. To back them up:

```bash
cd backend
npm run backup
```

This creates `backend/backups/<date-time>/` with `database.sql`, all photos and `HOW-TO-RESTORE.txt`. Copy that folder somewhere safe (Google Drive, a USB stick…).

To restore (replaces everything in the database): `npm run restore -- backups/<folder> --yes`

## Everyday use

- **Shop:** http://localhost:3000
- **Admin:** http://localhost:3000/admin/login (also linked as "Staff login" in the footer)
- **Change the admin password:** Admin → Settings
- **Low-stock warning level:** `LOW_STOCK` in `frontend/src/utils/shop.js`

## Tests

```bash
cd frontend
npm test
```

## Before publishing

- Set `SITE_URL` in `backend/.env` to the real website address.
- Set `REACT_APP_API_URL` in `frontend/.env` to the real API address, and `REACT_APP_SITE_URL` to the real website address (used by link previews), then build with `npm run build`.
- If you use Google sign-in, add the real address to the Client ID's **Authorized JavaScript origins**.
- Use a strong admin password and a new `JWT_SECRET`.

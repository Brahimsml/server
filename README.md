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

- Node.js 18 or newer
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

Never commit `backend/.env`; it holds your secrets (it's already in `.gitignore`).

Create the first admin account, then hash its password:

```sql
INSERT INTO pc_store.admins (email, password) VALUES ('admin@example.com', 'choose-a-strong-password');
```

```bash
npm run hash-admin-passwords
npm start
```

The API runs on http://localhost:5001.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

The site opens on http://localhost:3000. The backend address is set in `frontend/.env` (`REACT_APP_API_URL`); restart `npm start` after changing it.

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
- Set `REACT_APP_API_URL` in `frontend/.env` to the real API address, then build with `npm run build`.
- Use a strong admin password and a new `JWT_SECRET`.

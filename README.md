# Grace Of God Xchange — Website

A complete website for Grace Of God Xchange: a public landing page, a working
contact form, and an admin panel you can log into to manage services and
view messages — no coding required for day-to-day updates.

## What's in here

```
backend/
  server.js          → the whole backend (API + admin auth)
  package.json        → dependencies
  .env.example         → settings template (copy to .env)
  public/
    index.html          → the public website (single file, as requested)
    admin.html          → your admin panel (login at /admin.html)
  data/                 → where your services/messages/bookings get saved
                          (created automatically the first time you run it)
```

The frontend and backend are served from the **same app**, so you only
need to deploy one thing.

## 1. Run it on your own computer (to test)

You'll need [Node.js](https://nodejs.org) installed (free, takes 2 minutes).

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` in any text editor and change `JWT_SECRET` to a random string,
and set your own `ADMIN_DEFAULT_PASSWORD`. Then:

```bash
npm start
```

Visit:
- **Website:** http://localhost:4000
- **Admin panel:** http://localhost:4000/admin.html
  - Username: whatever you set as `ADMIN_USERNAME` (default `admin`)
  - Password: whatever you set as `ADMIN_DEFAULT_PASSWORD`
  - **Change this password immediately** from the Settings tab once you log in.

## 2. Put it online (free options)

You need two things: hosting for this app, and a domain name (optional —
hosts give you a free `.onrender.com` style address to start with).

**Easiest free option: Render.com**
1. Create a free account at render.com
2. Create a free GitHub account if you don't have one, and upload the
   `backend` folder to a new GitHub repository (GitHub has a simple
   drag-and-drop upload in the browser — no command line needed).
3. In Render, click **New → Web Service**, connect that GitHub repo.
4. Settings: Build command `npm install`, Start command `npm start`.
5. Under **Environment**, add the same variables from `.env.example`
   (`JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_DEFAULT_PASSWORD`).
6. Click **Create Web Service**. After a couple of minutes you'll get a
   live URL like `https://grace-of-god-xchange.onrender.com`.

**Adding your own domain** (e.g. `graceofgodxchange.com`): buy it from any
registrar (Namecheap, GoDaddy, etc.), then in Render go to your service →
Settings → Custom Domain, and follow the on-screen DNS instructions. Render
walks you through this with copy-paste records.

> Note: data is stored in plain JSON files on disk. This is simple and
> reliable for a single small site, but on some free hosts the disk resets
> on redeploy. If that matters to you, ask to have this upgraded to a
> persistent database (e.g. Postgres) — it's a small change to `server.js`.

## 3. Day-to-day maintenance (no code needed)

Go to `yourdomain.com/admin.html` and log in.

- **Services tab** — edit titles, descriptions, and rates, add or remove
  service cards. Click **Save Changes** when done — updates appear on the
  live site within seconds.
- **Messages tab** — every contact form submission appears here with the
  sender's name, email, phone and message.
- **Bookings tab** — a booking API is already built in (`POST /api/booking`)
  in case you want to add a booking form to the site later; submissions
  would show up here.
- **Settings tab** — change your admin password.

## 4. If you ever want a developer to make bigger changes

Everything is in plain, standard Express + vanilla HTML/CSS/JS — any
web developer (or Claude, in a future conversation) can pick this up
immediately. The whole site's styling lives in `public/index.html`.

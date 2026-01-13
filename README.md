# Proiect Tehnologii Web - Attendance Tracker

Under construction!

# Done:

- organizer can create an event or an event group (events within the group)
- participants can check in
- open/closed functionality is working properly
- events and groups can be deleted
- added recurring events
- UI looks nice + added favicon
- toasts work
- implement qr code feature
- add export features - csv/xlsx - currently buttons have no functionality
- final code review + refactoring

# To do:

- deploy
- create structured README

### Current app

<img width="1877" height="1077" alt="attendance_tracker" src="https://github.com/user-attachments/assets/e46f636d-8bde-4e83-84fc-91707942f095" />

### How to Run

1. Clone the repo

```
git clone https://github.com/andreeatcl/attendance-tracker.git
cd attendance-tracker
```

2. Install dependencies

```
cd server
npm install
cd ../client
npm install
cd ..
```

3. Install Postgres and create a DB

4. Create a .env file inside the server folder

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=user
DB_PASS=your_postgres_password_here

JWT_SECRET=put_a_long_random_string_here
PORT=5000

# CORS (for local dev)
CORS_ORIGIN=http://localhost:5173
```

Optional (recommended for Railway/any cloud Postgres): use a single connection string

```
DATABASE_URL=postgres://user:pass@host:5432/attendance_db
DB_SSL=true
```

Frontend env (Vite): create `client/.env`

```
VITE_API_URL=http://localhost:5000
```

5. Run the app (in separate terminals)

```
cd server
npm run dev
```

```
cd client
npm run dev
```

### Deployment notes (Railway)

Railway does not use your local `.env` files automatically. You still keep `.env` files for local development, but on Railway you must set the same keys in the Railway service **Variables**.

**Backend (Railway service: `server/`)**

- Create a new Railway project from this GitHub repo.
- Add a Postgres database in Railway (it will provide `DATABASE_URL`).
- Create a backend service from the `server/` folder.
- In the backend service **Variables**, set:
  - `NODE_ENV=production`
  - `JWT_SECRET=your_long_random_string`
  - `CORS_ORIGIN=https://your-frontend-domain` (you can provide multiple, comma-separated; you can temporarily use `*`)
  - `DB_SYNC_MODE=safe`
  - `DB_RESET` must NOT be set to `true` in production
  - `DATABASE_URL` (Railway usually injects this automatically when you link the DB)

Notes:

- Railway provides `PORT` automatically; the server already listens on `process.env.PORT`.
- If you use Railway Postgres, `DATABASE_URL` is the simplest config; you typically don’t need `DB_HOST/DB_NAME/...`.

**Frontend (Vite app)**

- Deploy the `client/` app wherever you want (Railway Static, Vercel, Netlify, etc.).
- Set `VITE_API_URL` to your deployed backend base URL (for example: `https://your-backend.up.railway.app`).

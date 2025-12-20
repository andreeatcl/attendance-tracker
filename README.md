# Proiect Tehnologii Web - Attendance Tracker

Under construction!

# Done:

- organizer can create an event or an event group (events within the group - but not recurring)
- participants can check in
- open/closed functionality is working properly

# To do:

- add recurring events feature
- fix minor UI/UX issues (incl. toast)
- review and refactor code where needed
- implement qr code feature
- add export features
- final code review + refactoring
- create structured README

### Current app

.

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
```

5. Run the app (in separate terminals)

```
cd server
node index.js
```

```
cd client
npm run dev
```

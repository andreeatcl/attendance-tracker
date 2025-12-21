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

# To do:

- implement qr code feature
- add export features - csv/xlsx - currently buttons have no functionality
- final code review + refactoring
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

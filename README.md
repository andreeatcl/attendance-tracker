# Proiect Tehnologii Web - Attendance Tracker

Under construction!

# To do:
- implement qr code feature
- fix UI/UX issues
- style toast properly
- fix organizer issues
- add repeat events feature
- connect event time to open/closed status and remove future
- add export features

### Current app
<img width="1868" height="1080" alt="image" src="https://github.com/user-attachments/assets/5d4c4e22-b16e-46bd-b3a1-812fa19154c4" />


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

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { sequelize } = require("./models");
const { Op } = require("sequelize");
const { Event, EventGroup } = require("./models");
const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const eventRoutes = require("./routes/events");
const attendanceRoutes = require("./routes/attendance");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/attendance", attendanceRoutes);

app.get("/", (req, res) => {
  res.send("Attendance API is running...");
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected!");

    try {
      await sequelize.query(
        'DELETE FROM "attendances" WHERE event_id IS NOT NULL AND event_id NOT IN (SELECT id FROM "Events")'
      );
    } catch (e) {
      console.warn("Could not cleanup orphaned attendances:", e?.message || e);
    }

    const forceSync =
      String(process.env.DB_FORCE_SYNC || "").toLowerCase() === "true";
    if (forceSync) {
      await sequelize.sync({ force: true });
    } else {
      await sequelize.sync({ alter: true });
    }
    console.log("Models synced to Database!");

    try {
      await sequelize.query(
        "UPDATE \"Events\" SET status ='CLOSED' WHERE status IS NULL OR status::text NOT IN ('OPEN','CLOSED')"
      );

      await sequelize.query(
        'ALTER TABLE "Events" ALTER COLUMN status DROP DEFAULT'
      );

      const [rows] = await sequelize.query(
        "SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Events' AND column_name = 'status'"
      );
      const typeName =
        rows && rows[0] && rows[0].udt_name ? String(rows[0].udt_name) : null;

      if (typeName) {
        const [typeRows] = await sequelize.query(
          `SELECT typtype FROM pg_type WHERE typname = '${typeName}' LIMIT 1`
        );
        const isEnum = Boolean(
          typeRows && typeRows[0] && typeRows[0].typtype === "e"
        );

        if (isEnum) {
          const [enumRows] = await sequelize.query(
            `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname = '${typeName}' ORDER BY e.enumsortorder`
          );
          const labels = (enumRows || []).map((r) => String(r.enumlabel));
          const hasOnlyOpenClosed =
            labels.length === 2 &&
            labels.includes("OPEN") &&
            labels.includes("CLOSED");

          if (!hasOnlyOpenClosed) {
            const tmpType = `${typeName}__clean`;
            await sequelize.query(
              `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${tmpType}') THEN
                  CREATE TYPE "${tmpType}" AS ENUM ('OPEN','CLOSED');
                END IF;
              END $$;`
            );
            await sequelize.query(
              `ALTER TABLE "Events" ALTER COLUMN status TYPE "${tmpType}" USING (status::text::"${tmpType}")`
            );
            await sequelize.query(`DROP TYPE IF EXISTS "${typeName}"`);
            await sequelize.query(
              `ALTER TYPE "${tmpType}" RENAME TO "${typeName}"`
            );
          }
        }
      }

      await sequelize.query(
        "ALTER TABLE \"Events\" ALTER COLUMN status SET DEFAULT 'CLOSED'"
      );
      await sequelize.query(
        'ALTER TABLE "Events" ALTER COLUMN status SET NOT NULL'
      );
    } catch (e) {
      console.warn("Could not normalize Events.status in DB:", e?.message || e);
    }

    try {
      await Event.update(
        { status: "CLOSED" },
        { where: { status: { [Op.notIn]: ["OPEN", "CLOSED"] } } }
      );
    } catch (e) {
      console.warn("Could not normalize event statuses:", e?.message || e);
    }

    try {
      const missingOrganizer = await Event.findAll({
        where: { organizerId: null, groupId: { [Op.ne]: null } },
        include: [{ model: EventGroup, as: "group" }],
      });
      for (const ev of missingOrganizer) {
        if (ev.group && ev.group.organizerId) {
          ev.organizerId = ev.group.organizerId;
          await ev.save();
        }
      }
    } catch (e) {
      console.warn("Could not backfill event organizerId:", e?.message || e);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

startServer();

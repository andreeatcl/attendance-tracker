const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { sequelize } = require("./models");
const { Op } = require("sequelize");
const { Event, EventGroup } = require("./models");
const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const eventRoutes = require("./routes/events");
const attendanceRoutes = require("./routes/attendance");

const app = express();
const PORT = process.env.PORT || 5000;

const isProd = String(process.env.NODE_ENV || "")
  .toLowerCase()
  .includes("prod");

if (isProd) {
  const required = [
    "JWT_SECRET",
    "DB_NAME",
    "DB_USER",
    "DB_PASS",
    "DB_HOST",
    "CORS_ORIGIN",
  ];
  const missing = required.filter((k) => !String(process.env[k] || "").trim());
  if (missing.length) {
    console.error(
      `Missing required environment variables for production: ${missing.join(
        ", "
      )}`
    );
    process.exit(1);
  }
}

const allowedOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProd) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
  })
);
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
  res.status(500).json({
    message: isProd
      ? "Internal server error"
      : err?.message || "Internal server error",
  });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected!");

    // Hard reset (DANGEROUS): wipes the whole public schema.
    // Opt-in only. Use when you want a totally clean DB.
    // Set DB_RESET=true for one run, then remove it.
    const dbReset = String(process.env.DB_RESET || "").toLowerCase() === "true";
    if (dbReset) {
      if (isProd) {
        throw new Error("DB_RESET is not allowed in production");
      }
      console.warn("DB_RESET=true: dropping public schema (ALL DATA LOST)");
      await sequelize.query("DROP SCHEMA IF EXISTS public CASCADE");
      await sequelize.query("CREATE SCHEMA public");
    }

    const syncMode = String(
      process.env.DB_SYNC_MODE || (isProd ? "safe" : "alter")
    ).toLowerCase();

    if (syncMode === "force") {
      if (isProd) {
        throw new Error("DB_SYNC_MODE=force is not allowed in production");
      }
      await sequelize.sync({ force: true });
    } else if (syncMode === "alter") {
      if (isProd) {
        throw new Error("DB_SYNC_MODE=alter is not allowed in production");
      }
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }
    console.log("Models synced to Database!");

    const runDbFixups =
      String(process.env.RUN_DB_FIXUPS || "").toLowerCase() === "true";

    if (runDbFixups)
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
        console.warn(
          "Could not normalize Events.status in DB:",
          e?.message || e
        );
      }

    if (runDbFixups)
      try {
        await Event.update(
          { status: "CLOSED" },
          { where: { status: { [Op.notIn]: ["OPEN", "CLOSED"] } } }
        );
      } catch (e) {
        console.warn("Could not normalize event statuses:", e?.message || e);
      }

    if (runDbFixups)
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

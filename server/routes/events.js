const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  listStandaloneEvents,
  createStandaloneEvent,
  getEventByCode,
  listAttendance,
} = require("../controllers/eventController");

const router = express.Router();

router.get(
  "/standalone",
  authRequired,
  requireRole("organizer"),
  listStandaloneEvents
);
router.post(
  "/standalone",
  authRequired,
  requireRole("organizer"),
  createStandaloneEvent
);

router.get("/code/:code", authRequired, getEventByCode);
router.get(
  "/:eventId/attendance",
  authRequired,
  requireRole("organizer"),
  listAttendance
);

module.exports = router;

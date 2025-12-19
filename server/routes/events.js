const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  setEventStatus,
  getEventByCode,
  listAttendance,
} = require("../controllers/eventController");

const router = express.Router();

router.get("/code/:code", authRequired, getEventByCode);

router.patch(
  "/:eventId/status",
  authRequired,
  requireRole("organizer"),
  setEventStatus
);
router.get(
  "/:eventId/attendance",
  authRequired,
  requireRole("organizer"),
  listAttendance
);

module.exports = router;

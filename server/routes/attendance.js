const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { checkIn } = require("../controllers/attendanceController");

const router = express.Router();

router.post("/check-in", authRequired, requireRole("participant"), checkIn);

module.exports = router;

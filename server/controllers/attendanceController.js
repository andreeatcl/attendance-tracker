const { Event, Attendance } = require("../models");

async function checkIn(req, res) {
  const { code } = req.body || {};
  const accessCode = String(code || "")
    .trim()
    .toUpperCase();

  if (!accessCode) {
    return res.status(400).json({ message: "code is required" });
  }

  const event = await Event.findOne({ where: { accessCode } });
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (event.status !== "OPEN") {
    return res.status(400).json({ message: "Event is not OPEN" });
  }

  const [attendance, created] = await Attendance.findOrCreate({
    where: { participantId: req.user.id, eventId: event.id },
    defaults: { participantId: req.user.id, eventId: event.id },
  });

  return res.status(created ? 201 : 200).json({
    message: created ? "Checked in" : "Already checked in",
    event: {
      id: event.id,
      accessCode: event.accessCode,
      status: event.status,
    },
    attendance: {
      id: attendance.id,
      createdAt: attendance.createdAt,
    },
  });
}

module.exports = {
  checkIn,
};

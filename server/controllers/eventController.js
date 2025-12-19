const { EventGroup, Event, Attendance, User } = require("../models");
const { generateAccessCode } = require("../utils/accessCode");

function parseStartTime(value) {
  if (value instanceof Date) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Accept both "YYYY-MM-DDTHH:mm" and "YYYY-MM-DD HH:mm".
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function listEventsForGroup(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ message: "Invalid groupId" });
  }

  const group = await EventGroup.findOne({
    where: { id: groupId, organizerId: req.user.id },
  });

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  const events = await Event.findAll({
    where: { groupId },
    order: [["id", "DESC"]],
  });

  return res.json({ group, events });
}

async function createEvent(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ message: "Invalid groupId" });
  }

  const { name, startTime, duration } = req.body || {};
  if (!name || !startTime || !duration) {
    return res
      .status(400)
      .json({ message: "name, startTime and duration are required" });
  }

  const parsedStart = parseStartTime(startTime);
  if (!parsedStart) {
    return res.status(400).json({ message: "Invalid startTime" });
  }

  const group = await EventGroup.findOne({
    where: { id: groupId, organizerId: req.user.id },
  });

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  let accessCode = generateAccessCode(6);
  // ensure uniqueness (best-effort)
  // eslint-disable-next-line no-await-in-loop
  while (await Event.findOne({ where: { accessCode } })) {
    accessCode = generateAccessCode(6);
  }

  const event = await Event.create({
    groupId,
    accessCode,
    name: String(name).trim(),
    startTime: parsedStart,
    duration: Number(duration),
    status: "FUTURE",
  });

  return res.status(201).json({ event });
}

async function setEventStatus(req, res) {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  const { status } = req.body || {};
  if (!status || !["OPEN", "CLOSED", "FUTURE"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const event = await Event.findByPk(eventId, {
    include: [{ model: EventGroup, as: "group" }],
  });
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (!event.group || event.group.organizerId !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  event.status = status;
  await event.save();

  return res.json({ event });
}

async function getEventByCode(req, res) {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  if (!code) {
    return res.status(400).json({ message: "code is required" });
  }

  const event = await Event.findOne({
    where: { accessCode: code },
    include: [{ model: EventGroup, as: "group" }],
  });

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  const attendance = await Attendance.findOne({
    where: { eventId: event.id, participantId: req.user.id },
  });

  return res.json({
    event: {
      id: event.id,
      accessCode: event.accessCode,
      name: event.name,
      startTime: event.startTime,
      duration: event.duration,
      status: event.status,
      groupId: event.groupId,
      checkedIn: Boolean(attendance),
      checkedInAt: attendance ? attendance.createdAt : null,
    },
  });
}

async function listAttendance(req, res) {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  const event = await Event.findByPk(eventId, {
    include: [{ model: EventGroup, as: "group" }],
  });
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (!event.group || event.group.organizerId !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const attendances = await Attendance.findAll({
    where: { eventId },
    include: [
      {
        model: User,
        as: "participant",
        attributes: ["id", "firstName", "lastName", "email", "role"],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return res.json({
    event: {
      id: event.id,
      accessCode: event.accessCode,
      name: event.name,
      status: event.status,
      startTime: event.startTime,
      duration: event.duration,
    },
    attendances: attendances.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      participant: a.participant,
    })),
  });
}

module.exports = {
  listEventsForGroup,
  createEvent,
  setEventStatus,
  getEventByCode,
  listAttendance,
};

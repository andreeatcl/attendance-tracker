const { EventGroup, Event, Attendance, User } = require("../models");
const { generateAccessCode } = require("../utils/accessCode");
const { getEventWindowStatus } = require("../utils/eventWindow");

function parseStartTime(value) {
  if (value instanceof Date) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;

  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;

  const dt = new Date(year, month - 1, day, hour, minute, second, 0);
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

  return res.json({
    group,
    events: events.map((event) => {
      const { isOpen, status, endTime } = getEventWindowStatus(event);
      return {
        id: event.id,
        groupId: event.groupId,
        accessCode: event.accessCode,
        name: event.name,
        startTime: event.startTime,
        duration: event.duration,
        endTime,
        isOpen,
        status,
      };
    }),
  });
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
  while (await Event.findOne({ where: { accessCode } })) {
    accessCode = generateAccessCode(6);
  }

  const event = await Event.create({
    groupId,
    organizerId: group.organizerId,
    accessCode,
    name: String(name).trim(),
    startTime: parsedStart,
    duration: Number(duration),
    status: getEventWindowStatus({ startTime: parsedStart, duration }).status,
  });

  const { isOpen, status, endTime } = getEventWindowStatus(event);
  return res.status(201).json({
    event: {
      id: event.id,
      groupId: event.groupId,
      accessCode: event.accessCode,
      name: event.name,
      startTime: event.startTime,
      duration: event.duration,
      endTime,
      isOpen,
      status,
    },
  });
}

async function listStandaloneEvents(req, res) {
  const events = await Event.findAll({
    where: { organizerId: req.user.id, groupId: null },
    order: [["id", "DESC"]],
  });

  return res.json({
    events: events.map((event) => {
      const { isOpen, status, endTime } = getEventWindowStatus(event);
      return {
        id: event.id,
        groupId: event.groupId,
        accessCode: event.accessCode,
        name: event.name,
        startTime: event.startTime,
        duration: event.duration,
        endTime,
        isOpen,
        status,
      };
    }),
  });
}

async function createStandaloneEvent(req, res) {
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

  let accessCode = generateAccessCode(6);
  while (await Event.findOne({ where: { accessCode } })) {
    accessCode = generateAccessCode(6);
  }

  const event = await Event.create({
    groupId: null,
    organizerId: req.user.id,
    accessCode,
    name: String(name).trim(),
    startTime: parsedStart,
    duration: Number(duration),
    status: getEventWindowStatus({ startTime: parsedStart, duration }).status,
  });

  const { isOpen, status, endTime } = getEventWindowStatus(event);
  return res.status(201).json({
    event: {
      id: event.id,
      groupId: event.groupId,
      accessCode: event.accessCode,
      name: event.name,
      startTime: event.startTime,
      duration: event.duration,
      endTime,
      isOpen,
      status,
    },
  });
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

  const { isOpen, status, endTime } = getEventWindowStatus(event);

  return res.json({
    event: {
      id: event.id,
      accessCode: event.accessCode,
      name: event.name,
      startTime: event.startTime,
      duration: event.duration,
      endTime,
      isOpen,
      status,
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

  const isGroupOwned = Boolean(event.group && event.group.organizerId);
  const organizerId = isGroupOwned
    ? event.group.organizerId
    : event.organizerId;
  if (organizerId !== req.user.id) {
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

  const { isOpen, status, endTime } = getEventWindowStatus(event);

  return res.json({
    event: {
      id: event.id,
      accessCode: event.accessCode,
      name: event.name,
      startTime: event.startTime,
      duration: event.duration,
      endTime,
      isOpen,
      status,
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
  listStandaloneEvents,
  createStandaloneEvent,
  getEventByCode,
  listAttendance,
};

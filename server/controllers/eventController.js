const { EventGroup, Event, Attendance, User, EventSkip } = require("../models");
const { UniqueConstraintError } = require("sequelize");
const { generateAccessCode } = require("../utils/accessCode");
const {
  getEventWindowStatus,
  parseStartTime,
} = require("../utils/eventWindow");
const {
  getGroupSchedule,
  getCurrentOccurrenceStart,
  getNextOccurrenceStart,
  toDateOnlyString,
  toTimeHHmmString,
} = require("../utils/recurrence");
const QRCode = require("qrcode");

function roundUpMinutes(date, stepMinutes) {
  const d = new Date(date.getTime());
  const ms = stepMinutes * 60 * 1000;
  const rounded = Math.ceil(d.getTime() / ms) * ms;
  return new Date(rounded);
}

async function createUniqueAccessCode(length = 6) {
  let accessCode = generateAccessCode(length);
  while (await Event.findOne({ where: { accessCode } })) {
    accessCode = generateAccessCode(length);
  }
  return accessCode;
}

async function ensureGroupEventForStart(group, startTime) {
  const skip = await EventSkip.findOne({
    where: { groupId: group.id, startTime },
  });
  if (skip) return null;

  const existing = await Event.findOne({
    where: { groupId: group.id, startTime },
  });
  if (existing) return existing;

  const duration = Number(group.defaultDuration) || 60;
  const name = String(group.defaultEventName || group.name || "").trim();

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const accessCode = await createUniqueAccessCode(6);
    try {
      return await Event.create({
        groupId: group.id,
        organizerId: group.organizerId,
        accessCode,
        name,
        startTime,
        duration,
        status: getEventWindowStatus({ startTime, duration }).status,
      });
    } catch (e) {
      lastError = e;
      if (e instanceof UniqueConstraintError) {
        const maybeExisting = await Event.findOne({
          where: { groupId: group.id, startTime },
        });
        if (maybeExisting) return maybeExisting;
        continue;
      }
      throw e;
    }
  }

  const maybeExisting = await Event.findOne({
    where: { groupId: group.id, startTime },
  });
  if (maybeExisting) return maybeExisting;
  throw lastError || new Error("Failed to create recurring event occurrence");
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

  try {
    let schedule = getGroupSchedule(group);

    if (!schedule) {
      const now = new Date();
      const normalizedRecurrence = String(group.recurrence || "").toUpperCase();
      const shouldBackfill =
        !normalizedRecurrence ||
        normalizedRecurrence === "NONE" ||
        !group.recurrenceStartDate ||
        !group.recurrenceTime ||
        !group.defaultDuration;

      if (shouldBackfill) {
        const rounded = roundUpMinutes(now, 5);
        group.recurrence =
          normalizedRecurrence && normalizedRecurrence !== "NONE"
            ? normalizedRecurrence
            : "WEEKLY";
        group.recurrenceStartDate =
          group.recurrenceStartDate || toDateOnlyString(now);
        group.recurrenceTime =
          group.recurrenceTime || toTimeHHmmString(rounded);
        group.defaultDuration = Number(group.defaultDuration) || 60;
        await group.save();
      }

      schedule = getGroupSchedule(group);
    }

    if (schedule) {
      const now = new Date();
      const currentStart = getCurrentOccurrenceStart(schedule, now);
      const nextStart = getNextOccurrenceStart(schedule, now);

      const uniqueStarts = [];
      for (const st of [currentStart, nextStart]) {
        if (!st) continue;
        if (!uniqueStarts.some((d) => d.getTime() === st.getTime())) {
          uniqueStarts.push(st);
        }
      }

      for (const startTime of uniqueStarts) {
        await ensureGroupEventForStart(group, startTime);
      }
    }
  } catch (e) {
    console.error("Recurring generation failed:", e);
  }

  const events = await Event.findAll({
    where: { groupId },
    order: [["startTime", "DESC"]],
    limit: 12,
  });

  return res.json({
    group: {
      id: group.id,
      name: group.name,
      organizerId: group.organizerId,
      recurrence: group.recurrence,
      recurrenceStartDate: group.recurrenceStartDate,
      recurrenceTime: group.recurrenceTime,
      defaultDuration: group.defaultDuration,
      defaultEventName: group.defaultEventName,
    },
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
  if (!(parsedStart instanceof Date) || Number.isNaN(parsedStart.getTime())) {
    return res.status(400).json({ message: "Invalid startTime" });
  }

  const group = await EventGroup.findOne({
    where: { id: groupId, organizerId: req.user.id },
  });

  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (String(group.recurrence || "NONE").toUpperCase() !== "NONE") {
    return res.status(400).json({
      message:
        "This group is recurring. Update the group's schedule; events are generated automatically.",
    });
  }

  const accessCode = await createUniqueAccessCode(6);

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
  if (!(parsedStart instanceof Date) || Number.isNaN(parsedStart.getTime())) {
    return res.status(400).json({ message: "Invalid startTime" });
  }

  const accessCode = await createUniqueAccessCode(6);

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

async function deleteEvent(req, res) {
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

  if (event.groupId) {
    try {
      await EventSkip.create({
        groupId: event.groupId,
        startTime: event.startTime,
      });
    } catch (e) {
      if (!(e instanceof UniqueConstraintError)) {
        throw e;
      }
    }
  }

  await event.destroy();
  return res.json({ ok: true });
}

async function getEventQRCode(req, res) {
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

  try {
    // Generate QR code as data URL
    const qrDataURL = await QRCode.toDataURL(event.accessCode, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
    });

    return res.json({
      qrCode: qrDataURL,
      accessCode: event.accessCode,
      eventId: event.id,
      eventName: event.name,
    });
  } catch (error) {
    console.error("QR code generation error:", error);
    return res.status(500).json({ message: "Failed to generate QR code" });
  }
}

module.exports = {
  listEventsForGroup,
  createEvent,
  listStandaloneEvents,
  createStandaloneEvent,
  getEventByCode,
  listAttendance,
  deleteEvent,
  getEventQRCode,
};

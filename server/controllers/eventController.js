const { EventGroup, Event, Attendance, User, EventSkip } = require("../models");
const { UniqueConstraintError } = require("sequelize");
const { generateAccessCode } = require("../utils/accessCode");
const { Parser } = require("json2csv");
const XLSX = require("xlsx");
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

const ATTENDANCE_EXPORT_FIELDS = [
  "event_name",
  "event_date",
  "event_time",
  "organizer_name",
  "organizer_email",
  "participant_name",
  "participant_email",
  "participant_checkin_datetime",
];

function normalizeAsciiLettersOnly(value) {
  const s = String(value || "");
  const withoutDiacritics = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lettersOnly = withoutDiacritics.replace(/[^A-Za-z]/g, "");
  return lettersOnly;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildEventExportBaseFilename(event) {
  const name = normalizeAsciiLettersOnly(event?.name);
  const date = event?.startTime
    ? digitsOnly(toDateOnlyString(event.startTime))
    : "";
  const time = event?.startTime
    ? digitsOnly(toTimeHHmmString(event.startTime))
    : "";
  const safeName = name || "event";
  const parts = [safeName, date, time, "participants"].filter(Boolean);
  return parts.join("_");
}

function buildGroupExportBaseFilename(group) {
  const name = normalizeAsciiLettersOnly(group?.name);
  return `${name || "group"}_participants`;
}

async function tryGenerateQRCodeDataUrl(accessCode) {
  try {
    const { generateQRCode } = require("../utils/qrCode");
    return await generateQRCode(accessCode);
  } catch {
    return null;
  }
}

function getUserDisplayName(user) {
  const first = String(user?.firstName || "").trim();
  const last = String(user?.lastName || "").trim();
  return [first, last].filter(Boolean).join(" ");
}

function toIsoOrEmpty(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function toAttendanceExportRow({ event, attendance }) {
  const participant = attendance?.participant;
  const organizer = event?.group?.organizer || event?.organizer || null;
  const eventStart = event?.startTime;

  return {
    event_name: String(event?.name || "").trim(),
    event_date: eventStart ? toDateOnlyString(eventStart) : "",
    event_time: eventStart ? toTimeHHmmString(eventStart) : "",
    organizer_name: getUserDisplayName(organizer),
    organizer_email: String(organizer?.email || "").trim(),
    participant_name: getUserDisplayName(participant),
    participant_email: String(participant?.email || "").trim(),
    participant_checkin_datetime: toIsoOrEmpty(attendance?.createdAt),
  };
}

function assertEventOwnedByOrganizer(event, organizerId) {
  const isGroupOwned = Boolean(event?.group && event.group.organizerId);
  const effectiveOrganizerId = isGroupOwned
    ? event.group.organizerId
    : event.organizerId;
  return Number(effectiveOrganizerId) === Number(organizerId);
}

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

  // Generează codul QR pentru fiecare eveniment (asincron)
  const eventsWithQr = await Promise.all(
    events.map(async (event) => {
      const { isOpen, status, endTime } = getEventWindowStatus(event);
      const qrCode = await tryGenerateQRCodeDataUrl(event.accessCode);
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
        qrCode,
      };
    })
  );

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
    events: eventsWithQr,
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

  const qrCodeDataUrl = await tryGenerateQRCodeDataUrl(event.accessCode);

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
      qrCode: qrCodeDataUrl,
    },
  });
}

async function listStandaloneEvents(req, res) {
  const events = await Event.findAll({
    where: { organizerId: req.user.id, groupId: null },
    order: [["id", "DESC"]],
  });

  // Generează codul QR pentru fiecare eveniment (asincron)
  const eventsWithQr = await Promise.all(
    events.map(async (event) => {
      const { isOpen, status, endTime } = getEventWindowStatus(event);
      const qrCode = await tryGenerateQRCodeDataUrl(event.accessCode);
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
        qrCode,
      };
    })
  );

  return res.json({
    events: eventsWithQr,
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

// Exportă participanții unui eveniment în CSV
async function exportEventParticipantsCSV(req, res) {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({
      where: { id: eventId },
      include: [
        {
          model: EventGroup,
          as: "group",
          include: [
            {
              model: User,
              as: "organizer",
              attributes: ["firstName", "lastName", "email"],
            },
          ],
        },
        {
          model: User,
          as: "organizer",
          attributes: ["firstName", "lastName", "email"],
        },
      ],
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!assertEventOwnedByOrganizer(event, req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const attendances = await Attendance.findAll({
      where: { eventId },
      include: [
        {
          model: User,
          as: "participant",
          attributes: ["firstName", "lastName", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const rows = attendances.map((a) =>
      toAttendanceExportRow({ event, attendance: a })
    );

    const parser = new Parser({ fields: ATTENDANCE_EXPORT_FIELDS });
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`${buildEventExportBaseFilename(event)}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("Export CSV error:", err);
    return res
      .status(500)
      .json({ message: "Export CSV failed", error: String(err) });
  }
}

// Exportă participanții unui grup de evenimente în CSV
async function exportGroupParticipantsCSV(req, res) {
  try {
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
      attributes: ["id"],
    });
    const eventIds = events.map((e) => e.id).filter((id) => id != null);
    if (!eventIds.length) {
      const parser = new Parser({ fields: ATTENDANCE_EXPORT_FIELDS });
      const csv = parser.parse([]);
      res.header("Content-Type", "text/csv");
      res.attachment(`${buildGroupExportBaseFilename(group)}.csv`);
      return res.send(csv);
    }

    const attendances = await Attendance.findAll({
      where: { eventId: eventIds },
      include: [
        {
          model: User,
          as: "participant",
          attributes: ["firstName", "lastName", "email"],
        },
        {
          model: Event,
          as: "event",
          attributes: ["name", "startTime"],
          include: [
            {
              model: User,
              as: "organizer",
              attributes: ["firstName", "lastName", "email"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const rows = attendances.map((a) =>
      toAttendanceExportRow({ event: a.event, attendance: a })
    );

    const parser = new Parser({ fields: ATTENDANCE_EXPORT_FIELDS });
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`${buildGroupExportBaseFilename(group)}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("Export group CSV error:", err);
    return res
      .status(500)
      .json({ message: "Export CSV failed", error: String(err) });
  }
}

// Exportă participanții unui eveniment în XLSX (doar nume și email)
async function exportEventParticipantsXLSX(req, res) {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({
      where: { id: eventId },
      include: [
        {
          model: EventGroup,
          as: "group",
          include: [
            {
              model: User,
              as: "organizer",
              attributes: ["firstName", "lastName", "email"],
            },
          ],
        },
        {
          model: User,
          as: "organizer",
          attributes: ["firstName", "lastName", "email"],
        },
      ],
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (!assertEventOwnedByOrganizer(event, req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const attendances = await Attendance.findAll({
      where: { eventId },
      include: [
        {
          model: User,
          as: "participant",
          attributes: ["firstName", "lastName", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const rows = attendances.map((a) =>
      toAttendanceExportRow({ event, attendance: a })
    );

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ATTENDANCE_EXPORT_FIELDS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.attachment(`${buildEventExportBaseFilename(event)}.xlsx`);
    return res.send(buffer);
  } catch (err) {
    console.error("Export XLSX error:", err);
    return res
      .status(500)
      .json({ message: "Export XLSX failed", error: String(err) });
  }
}

// Exportă participanții unui grup de evenimente în XLSX (doar nume și email)
async function exportGroupParticipantsXLSX(req, res) {
  try {
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

    const attendances = await Attendance.findAll({
      include: [
        {
          model: User,
          as: "participant",
          attributes: ["firstName", "lastName", "email"],
        },
        {
          model: Event,
          as: "event",
          attributes: ["name", "startTime"],
          where: { groupId },
          include: [
            {
              model: User,
              as: "organizer",
              attributes: ["firstName", "lastName", "email"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const rows = attendances.map((a) =>
      toAttendanceExportRow({ event: a.event, attendance: a })
    );

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ATTENDANCE_EXPORT_FIELDS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.attachment(`${buildGroupExportBaseFilename(group)}.xlsx`);
    return res.send(buffer);
  } catch (err) {
    console.error("Export XLSX error:", err);
    return res
      .status(500)
      .json({ message: "Export XLSX failed", error: String(err) });
  }
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

module.exports = {
  listEventsForGroup,
  createEvent,
  listStandaloneEvents,
  createStandaloneEvent,
  getEventByCode,
  listAttendance,
  deleteEvent,
  exportEventParticipantsCSV,
  exportGroupParticipantsCSV,
  exportEventParticipantsXLSX,
  exportGroupParticipantsXLSX,
};

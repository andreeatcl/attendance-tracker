const {
  EventGroup,
  Event,
  Attendance,
  EventSkip,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const {
  normalizeRecurrence,
  parseDateOnly,
  parseTimeHHmm,
  toDateOnlyString,
  toTimeHHmmString,
} = require("../utils/recurrence");

async function listGroups(req, res) {
  const groups = await EventGroup.findAll({
    where: { organizerId: req.user.id },
    order: [["id", "DESC"]],
  });

  return res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      organizerId: g.organizerId,
      recurrence: g.recurrence,
      recurrenceStartDate: g.recurrenceStartDate,
      recurrenceTime: g.recurrenceTime,
      defaultDuration: g.defaultDuration,
      defaultEventName: g.defaultEventName,
    })),
  });
}

async function createGroup(req, res) {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  const now = new Date();
  const defaultStartDate = toDateOnlyString(now);
  const defaultTime = toTimeHHmmString(now);

  const group = await EventGroup.create({
    name,
    organizerId: req.user.id,
    recurrence: "WEEKLY",
    recurrenceStartDate: defaultStartDate,
    recurrenceTime: defaultTime,
    defaultDuration: 60,
    defaultEventName: null,
  });

  return res.status(201).json({
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
  });
}

async function updateGroupSettings(req, res) {
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

  const {
    recurrence,
    recurrenceStartDate,
    recurrenceTime,
    defaultDuration,
    defaultEventName,
  } = req.body || {};

  const normalizedRecurrence = normalizeRecurrence(recurrence);
  if (!normalizedRecurrence) {
    return res.status(400).json({
      message:
        "Invalid recurrence. Allowed: NONE, DAILY, WEEKDAY, WEEKLY, BIWEEKLY, MONTHLY",
    });
  }

  if (normalizedRecurrence === "NONE") {
    group.recurrence = "NONE";
    group.recurrenceStartDate = null;
    group.recurrenceTime = null;
    group.defaultDuration = null;
    group.defaultEventName =
      defaultEventName === undefined || defaultEventName === null
        ? group.defaultEventName
        : String(defaultEventName).trim() || null;

    await group.save();
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
    });
  }

  const parsedDate = parseDateOnly(recurrenceStartDate);
  if (!parsedDate) {
    return res
      .status(400)
      .json({ message: "Invalid recurrenceStartDate (YYYY-MM-DD)" });
  }
  const parsedTime = parseTimeHHmm(recurrenceTime);
  if (!parsedTime) {
    return res.status(400).json({ message: "Invalid recurrenceTime (HH:mm)" });
  }
  const dur = Number(defaultDuration);
  if (!Number.isFinite(dur) || dur <= 0) {
    return res
      .status(400)
      .json({ message: "defaultDuration must be a positive number" });
  }

  group.recurrence = normalizedRecurrence;
  group.recurrenceStartDate = String(recurrenceStartDate);
  group.recurrenceTime = String(recurrenceTime);
  group.defaultDuration = dur;
  group.defaultEventName = String(defaultEventName || "").trim() || null;

  await group.save();

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
  });
}

async function deleteGroup(req, res) {
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

  await sequelize.transaction(async (t) => {
    const events = await Event.findAll({
      where: { groupId },
      attributes: ["id"],
      transaction: t,
    });
    const eventIds = events.map((e) => e.id).filter((id) => id != null);

    if (eventIds.length) {
      await Attendance.destroy({
        where: { eventId: { [Op.in]: eventIds } },
        transaction: t,
      });
    }

    await Event.destroy({ where: { groupId }, transaction: t });
    await EventSkip.destroy({ where: { groupId }, transaction: t });
    await group.destroy({ transaction: t });
  });

  return res.json({ ok: true });
}

module.exports = {
  listGroups,
  createGroup,
  updateGroupSettings,
  deleteGroup,
};

const { sequelize } = require("../config/database");
const User = require("./User");
const EventGroup = require("./EventGroup");
const Event = require("./Event");
const Attendance = require("./Attendance");
const EventSkip = require("./EventSkip");

User.hasMany(EventGroup, { foreignKey: "organizerId" });
EventGroup.belongsTo(User, { as: "organizer", foreignKey: "organizerId" });

User.hasMany(Event, { as: "organizedEvents", foreignKey: "organizerId" });
Event.belongsTo(User, { as: "organizer", foreignKey: "organizerId" });

EventGroup.hasMany(Event, { foreignKey: "groupId" });
Event.belongsTo(EventGroup, { as: "group", foreignKey: "groupId" });

User.hasMany(Attendance, { as: "attendances", foreignKey: "participantId" });
Attendance.belongsTo(User, { as: "participant", foreignKey: "participantId" });

Event.hasMany(Attendance, { as: "attendances", foreignKey: "eventId" });
Attendance.belongsTo(Event, { as: "event", foreignKey: "eventId" });

User.belongsToMany(Event, {
  as: "attendedEvents",
  through: Attendance,
  foreignKey: "participantId",
  otherKey: "eventId",
});
Event.belongsToMany(User, {
  as: "participants",
  through: Attendance,
  foreignKey: "eventId",
  otherKey: "participantId",
});

module.exports = {
  sequelize,
  User,
  EventGroup,
  Event,
  Attendance,
  EventSkip,
};

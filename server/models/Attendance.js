const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Attendance = sequelize.define(
  "Attendance",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    participantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "participant_id",
    },
    eventId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "event_id",
    },
  },
  {
    underscored: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["participant_id", "event_id"],
      },
    ],
  }
);

module.exports = Attendance;

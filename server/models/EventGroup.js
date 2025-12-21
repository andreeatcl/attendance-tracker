const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EventGroup = sequelize.define(
  "EventGroup",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    organizerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "organizerId",
    },
    recurrence: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "NONE",
      validate: {
        isIn: [["NONE", "DAILY", "WEEKDAY", "WEEKLY", "BIWEEKLY", "MONTHLY"]],
      },
    },
    recurrenceStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "recurrenceStartDate",
    },
    recurrenceTime: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "recurrenceTime",
    },
    defaultDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "defaultDuration",
    },
    defaultEventName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "defaultEventName",
    },
  },
  {
    underscored: false,
  }
);

module.exports = EventGroup;

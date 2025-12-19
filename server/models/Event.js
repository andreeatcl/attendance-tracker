const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Event = sequelize.define(
  "Event",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "group_id",
    },
    accessCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "access_code",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "start_time",
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "FUTURE",
      validate: {
        isIn: [["OPEN", "CLOSED", "FUTURE"]],
      },
    },
  },
  {
    underscored: true,
  }
);

module.exports = Event;

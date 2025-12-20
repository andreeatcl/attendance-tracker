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
      allowNull: true,
      field: "groupId",
    },
    organizerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "organizerId",
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
      defaultValue: "CLOSED",
      allowNull: false,
      validate: {
        isIn: [["OPEN", "CLOSED"]],
      },
    },
  },
  {
    underscored: false,
  }
);

module.exports = Event;

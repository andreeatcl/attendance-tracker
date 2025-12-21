const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EventSkip = sequelize.define(
  "EventSkip",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "groupId",
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "start_time",
    },
  },
  {
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ["groupId", "start_time"],
      },
    ],
  }
);

module.exports = EventSkip;

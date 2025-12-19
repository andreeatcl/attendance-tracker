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
      field: "organizer_id",
    },
  },
  {
    underscored: true,
  }
);

module.exports = EventGroup;

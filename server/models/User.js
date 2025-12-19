const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
      field: "first_name",
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
      field: "last_name",
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash",
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: "participant",
      validate: {
        isIn: [["organizer", "participant"]],
      },
    },
  },
  {
    underscored: true,
  }
);

module.exports = User;

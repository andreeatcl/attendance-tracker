const path = require("path");
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isProd = String(process.env.NODE_ENV || "")
  .toLowerCase()
  .includes("prod");

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const useSsl =
  String(process.env.DB_SSL || "").toLowerCase() === "true" ||
  Boolean(databaseUrl) ||
  isProd;

const dialectOptions = useSsl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : undefined;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: false,
      dialectOptions,
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
        dialect: "postgres",
        logging: false,
        dialectOptions,
      }
    );

module.exports = { sequelize };

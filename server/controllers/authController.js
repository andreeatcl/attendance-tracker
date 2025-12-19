const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

function signToken(user) {
  const secret = process.env.JWT_SECRET || "no_jwt_token";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn,
  });
}

async function register(req, res) {
  const { email, password, role, firstName, lastName } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const normalizedFirstName = String(firstName || "").trim();
  const normalizedLastName = String(lastName || "").trim();

  if (!normalizedFirstName || !normalizedLastName) {
    return res
      .status(400)
      .json({ message: "firstName and lastName are required" });
  }

  if (role && !["organizer", "participant"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const saltRounds = process.env.BCRYPT_SALT_ROUNDS
    ? Number(process.env.BCRYPT_SALT_ROUNDS)
    : 10;

  const passwordHash = await bcrypt.hash(password, saltRounds);
  const user = await User.create({
    email,
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    passwordHash,
    role: role || "participant",
  });

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id, {
    attributes: ["id", "email", "role", "firstName", "lastName"],
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user });
}

module.exports = {
  register,
  login,
  me,
};

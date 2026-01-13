const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing Authorization Bearer token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const secret = String(process.env.JWT_SECRET || "").trim();
    if (!secret) {
      return res.status(500).json({ message: "Server misconfigured" });
    }

    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = {
  authRequired,
};

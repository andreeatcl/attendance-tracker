function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user?.role) {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

module.exports = {
  requireRole,
};

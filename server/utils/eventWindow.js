function parseStartTime(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const raw = String(value || "").trim();
  if (!raw) return new Date(NaN);

  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = m[6] ? Number(m[6]) : 0;
    return new Date(year, month - 1, day, hour, minute, second, 0);
  }

  return new Date(raw);
}

function getEventWindowStatus(event, now = new Date()) {
  const start = parseStartTime(event?.startTime);

  const durationMinutes = Number(event?.duration);
  const safeDurationMinutes = Number.isFinite(durationMinutes)
    ? Math.max(0, durationMinutes)
    : 0;

  const startMs = start.getTime();
  if (Number.isNaN(startMs)) {
    return {
      isOpen: false,
      status: "CLOSED",
      startTime: null,
      endTime: null,
    };
  }

  const end = new Date(startMs + safeDurationMinutes * 60 * 1000);
  const nowMs = now.getTime();
  const endMs = end.getTime();

  const isOpen =
    safeDurationMinutes > 0 && nowMs >= startMs && Number.isFinite(endMs)
      ? nowMs < endMs
      : false;

  return {
    isOpen,
    status: isOpen ? "OPEN" : "CLOSED",
    startTime: start,
    endTime: end,
  };
}

module.exports = {
  getEventWindowStatus,
  parseStartTime,
};

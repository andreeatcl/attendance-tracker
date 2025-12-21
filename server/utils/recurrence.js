function parseDateOnly(value) {
  const s = String(value || "").trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function parseTimeHHmm(value) {
  const s = String(value || "").trim();
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(s);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toDateOnlyString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeHHmmString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function withTime(date, hour, minute) {
  const d = cloneDate(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = cloneDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function normalizeRecurrence(value) {
  const v = String(value || "NONE")
    .trim()
    .toUpperCase();
  const allowed = ["NONE", "DAILY", "WEEKDAY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
  return allowed.includes(v) ? v : null;
}

function getGroupSchedule(group) {
  const recurrence = normalizeRecurrence(group?.recurrence);
  if (!recurrence || recurrence === "NONE") return null;

  const startDate = group?.recurrenceStartDate
    ? parseDateOnly(group.recurrenceStartDate)
    : null;
  const time = group?.recurrenceTime
    ? parseTimeHHmm(group.recurrenceTime)
    : null;

  if (!startDate || !time) return null;

  const duration = Number(group?.defaultDuration);
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const anchorStart = withTime(startDate, time.hour, time.minute);

  return {
    recurrence,
    anchorStart,
    duration,
    eventName: String(group?.defaultEventName || "").trim(),
  };
}

function getCurrentOccurrenceStart(schedule, now) {
  const { recurrence, anchorStart, duration } = schedule;
  const timeHour = anchorStart.getHours();
  const timeMinute = anchorStart.getMinutes();

  let candidate = null;

  if (recurrence === "DAILY" || recurrence === "WEEKDAY") {
    candidate = withTime(now, timeHour, timeMinute);
    if (candidate < anchorStart) candidate = anchorStart;

    if (recurrence === "WEEKDAY") {
      while (isWeekend(candidate)) {
        candidate = addDays(candidate, -1);
        candidate = withTime(candidate, timeHour, timeMinute);
        if (candidate < anchorStart) {
          candidate = anchorStart;
          break;
        }
      }
    }
  } else if (recurrence === "WEEKLY") {
    const targetDow = anchorStart.getDay();
    candidate = withTime(now, timeHour, timeMinute);
    const diff = (candidate.getDay() - targetDow + 7) % 7;
    candidate = addDays(candidate, -diff);
    candidate = withTime(candidate, timeHour, timeMinute);
    if (candidate < anchorStart) candidate = anchorStart;
  } else if (recurrence === "BIWEEKLY") {
    const base = anchorStart;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((now.getTime() - base.getTime()) / msPerDay);
    const intervals = Math.floor(daysDiff / 14);
    candidate = addDays(base, intervals * 14);
    candidate = withTime(candidate, timeHour, timeMinute);
    if (candidate > now) {
      candidate = addDays(candidate, -14);
      candidate = withTime(candidate, timeHour, timeMinute);
    }
    if (candidate < base) candidate = base;
  } else if (recurrence === "MONTHLY") {
    const dayOfMonth = anchorStart.getDate();
    let year = now.getFullYear();
    let month = now.getMonth();

    let dom = Math.min(dayOfMonth, lastDayOfMonth(year, month));
    candidate = new Date(year, month, dom, timeHour, timeMinute, 0, 0);

    if (candidate > now) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      dom = Math.min(dayOfMonth, lastDayOfMonth(year, month));
      candidate = new Date(year, month, dom, timeHour, timeMinute, 0, 0);
    }

    if (candidate < anchorStart) candidate = anchorStart;
  }

  if (!candidate) return null;

  const end = new Date(candidate.getTime() + duration * 60 * 1000);
  if (now >= candidate && now < end) {
    return candidate;
  }

  return null;
}

function getNextOccurrenceStart(schedule, now) {
  const { recurrence, anchorStart } = schedule;
  const timeHour = anchorStart.getHours();
  const timeMinute = anchorStart.getMinutes();

  let candidate = null;

  if (recurrence === "DAILY" || recurrence === "WEEKDAY") {
    candidate = withTime(now, timeHour, timeMinute);
    if (candidate <= now) candidate = addDays(candidate, 1);
    candidate = withTime(candidate, timeHour, timeMinute);

    if (recurrence === "WEEKDAY") {
      while (isWeekend(candidate)) {
        candidate = addDays(candidate, 1);
        candidate = withTime(candidate, timeHour, timeMinute);
      }
    }

    if (candidate < anchorStart) candidate = anchorStart;
  } else if (recurrence === "WEEKLY") {
    const targetDow = anchorStart.getDay();
    candidate = withTime(now, timeHour, timeMinute);
    const ahead = (targetDow - candidate.getDay() + 7) % 7;
    candidate = addDays(candidate, ahead);
    candidate = withTime(candidate, timeHour, timeMinute);
    if (candidate <= now) {
      candidate = addDays(candidate, 7);
      candidate = withTime(candidate, timeHour, timeMinute);
    }
    if (candidate < anchorStart) candidate = anchorStart;
  } else if (recurrence === "BIWEEKLY") {
    const base = anchorStart;
    const msPerInterval = 14 * 24 * 60 * 60 * 1000;
    const diff = now.getTime() - base.getTime();
    const intervals = diff <= 0 ? 0 : Math.ceil(diff / msPerInterval);
    candidate = new Date(base.getTime() + intervals * msPerInterval);
    candidate = withTime(candidate, timeHour, timeMinute);
    if (candidate <= now) {
      candidate = new Date(candidate.getTime() + msPerInterval);
      candidate = withTime(candidate, timeHour, timeMinute);
    }
  } else if (recurrence === "MONTHLY") {
    const dayOfMonth = anchorStart.getDate();
    let year = now.getFullYear();
    let month = now.getMonth();

    let dom = Math.min(dayOfMonth, lastDayOfMonth(year, month));
    candidate = new Date(year, month, dom, timeHour, timeMinute, 0, 0);
    if (candidate <= now) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      dom = Math.min(dayOfMonth, lastDayOfMonth(year, month));
      candidate = new Date(year, month, dom, timeHour, timeMinute, 0, 0);
    }

    if (candidate < anchorStart) candidate = anchorStart;
  }

  if (!candidate) return null;
  if (candidate < anchorStart) return anchorStart;
  return candidate;
}

module.exports = {
  normalizeRecurrence,
  parseDateOnly,
  parseTimeHHmm,
  toDateOnlyString,
  toTimeHHmmString,
  getGroupSchedule,
  getCurrentOccurrenceStart,
  getNextOccurrenceStart,
};

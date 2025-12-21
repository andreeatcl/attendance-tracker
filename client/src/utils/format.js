function toValidDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toValidDate(value);
  return d ? d.toLocaleDateString() : "—";
}

export function formatTime(value) {
  const d = toValidDate(value);
  return d
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function formatDateTime(value) {
  const d = toValidDate(value);
  if (d) return d.toLocaleString();
  return value === undefined || value === null ? "" : String(value);
}

export function toDateOnlyString(value) {
  const d = toValidDate(value);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toTimeHHmmString(value) {
  const d = toValidDate(value);
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

import { api } from "./apiClient";

export async function getEventByCode(code) {
  const res = await api.get(`/events/code/${encodeURIComponent(code)}`);
  return res.data;
}

export async function setEventStatus(eventId, status) {
  const res = await api.patch(`/events/${eventId}/status`, { status });
  return res.data;
}

export async function listAttendance(eventId) {
  const res = await api.get(`/events/${eventId}/attendance`);
  return res.data;
}

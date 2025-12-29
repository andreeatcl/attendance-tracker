import { api } from "./apiClient";

export async function listStandaloneEvents() {
  const res = await api.get("/events/standalone");
  return res.data;
}

export async function createStandaloneEvent(name, startTime, duration) {
  const res = await api.post("/events/standalone", {
    name,
    startTime,
    duration,
  });
  return res.data;
}

export async function getEventByCode(code) {
  const res = await api.get(`/events/code/${encodeURIComponent(code)}`);
  return res.data;
}

export async function listAttendance(eventId) {
  const res = await api.get(`/events/${eventId}/attendance`);
  return res.data;
}

export async function deleteEvent(eventId) {
  const res = await api.delete(`/events/${eventId}`);
  return res.data;
}

export async function getEventQRCode(eventId) {
  const res = await api.get(`/events/${eventId}/qr`);
  return res.data;
}

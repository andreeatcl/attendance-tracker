import { api } from "./apiClient";

export async function listGroups() {
  const res = await api.get("/groups");
  return res.data;
}

export async function createGroup(name) {
  const res = await api.post("/groups", { name });
  return res.data;
}

export async function listGroupEvents(groupId) {
  const res = await api.get(`/groups/${groupId}/events`);
  return res.data;
}

export async function createGroupEvent(groupId, name, startTime, duration) {
  const res = await api.post(`/groups/${groupId}/events`, {
    name,
    startTime,
    duration,
  });
  return res.data;
}

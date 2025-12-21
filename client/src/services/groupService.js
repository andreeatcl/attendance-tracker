import { api } from "./apiClient";

export async function listGroups() {
  const res = await api.get("/groups");
  return res.data;
}

export async function createGroup(name) {
  const res = await api.post("/groups", { name });
  return res.data;
}

export async function updateGroupSettings(
  groupId,
  {
    recurrence,
    recurrenceStartDate,
    recurrenceTime,
    defaultDuration,
    defaultEventName,
  }
) {
  const res = await api.patch(`/groups/${groupId}/settings`, {
    recurrence,
    recurrenceStartDate,
    recurrenceTime,
    defaultDuration,
    defaultEventName,
  });
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

export async function deleteGroup(groupId) {
  const res = await api.delete(`/groups/${groupId}`);
  return res.data;
}

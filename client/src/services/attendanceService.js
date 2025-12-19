import { api } from "./apiClient";

export async function checkIn(code) {
  const res = await api.post("/attendance/check-in", { code });
  return res.data;
}

import { api } from "./apiClient";

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function register(email, password, role, firstName, lastName) {
  const res = await api.post("/auth/register", {
    email,
    password,
    role,
    firstName,
    lastName,
  });
  return res.data;
}

export async function me() {
  const res = await api.get("/auth/me");
  return res.data;
}

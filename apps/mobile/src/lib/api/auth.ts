import { apiFetch } from "./client";

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
};

export type MeResponse = {
  userId: string;
  email: string;
};

export async function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export async function fetchMe() {
  return apiFetch<MeResponse>("/auth/me");
}

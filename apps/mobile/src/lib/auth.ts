import { deleteStorageItem, getStorageItem, setStorageItem } from "./storage";

const TOKEN_KEY = "elp_mobile_access_token";
const USER_KEY = "elp_mobile_user";

export type SessionUser = {
  id?: string;
  userId?: string;
  email: string;
};

export async function getToken() {
  return getStorageItem(TOKEN_KEY);
}

export async function getStoredUser() {
  const raw = await getStorageItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function setSession(token: string, user: SessionUser) {
  await setStorageItem(TOKEN_KEY, token);
  await setStorageItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await deleteStorageItem(TOKEN_KEY);
  await deleteStorageItem(USER_KEY);
}

import { useCallback, useEffect, useState } from "react";
import { fetchMe, type MeResponse } from "../lib/api/auth";
import { clearSession, getStoredUser } from "../lib/auth";

export function useSessionBootstrap() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [storedEmail, setStoredEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const localUser = await getStoredUser();
      setStoredEmail(localUser?.email ?? "");
      const me = await fetchMe();
      setUser(me);
    } catch (err) {
      setUser(null);
      const localUser = await getStoredUser();
      setStoredEmail(localUser?.email ?? "");
      setError(err instanceof Error ? err.message : "세션 확인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStoredEmail("");
    setError("");
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    user,
    storedEmail,
    loading,
    error,
    reload,
    logout,
  };
}

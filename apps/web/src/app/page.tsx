"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api-client";
import { clearSession, getStoredUser, getToken, setSession } from "../lib/auth";

type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string };
};

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const existingUser = useMemo(() => getStoredUser(), []);

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
      return;
    }
    setBooting(false);
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<AuthResponse>(mode === "login" ? "/auth/login" : "/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data.accessToken, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return <main className="container"><div className="card">세션 확인 중...</div></main>;
  }

  return (
    <main className="container grid landing" style={{ gap: 24 }}>
      <section className="hero card">
        <div>
          <h1 className="h1" style={{ marginTop: 14 }}>내 언어 데이터 플랫폼</h1>
          <p className="muted" style={{ marginTop: 12 }}>
            내가 실제로 말한 음성과 문장을 모아 정리하고, 영어 학습과 다양한 AI 활용으로 다시 연결할 수 있는 개인 언어 데이터 서비스입니다.
          </p>
          <div className="grid feature-list" style={{ marginTop: 18 }}>
            <div className="mini-card"><strong>1. 수집</strong><div className="muted">녹음과 업로드로 내 언어 데이터를 모읍니다.</div></div>
            <div className="mini-card"><strong>2. 정리</strong><div className="muted">문장, 화자, 맥락, 표현을 구조화해 정리합니다.</div></div>
            <div className="mini-card"><strong>3. 활용</strong><div className="muted">영어 학습과 다양한 AI 활용으로 다시 연결합니다.</div></div>
          </div>
        </div>
      </section>

      <section className="card auth-card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="h2" style={{ marginBottom: 0 }}>{mode === "login" ? "로그인" : "회원가입"}</h2>
          {existingUser && (
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                clearSession();
                setError("저장된 세션을 초기화했습니다.");
              }}
            >
              저장 세션 초기화
            </button>
          )}
        </div>
        <form className="grid" style={{ gap: 12, marginTop: 16 }} onSubmit={onSubmit}>
          <label className="grid" style={{ gap: 8 }}>
            <span className="muted">이메일</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="grid" style={{ gap: 8 }}>
            <span className="muted">비밀번호</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="button" type="submit" disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "계정이 없으면 회원가입" : "이미 계정이 있으면 로그인"}
          </button>
        </div>
      </section>
    </main>
  );
}

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
          <span className="badge">스타트업 서비스 수준 MVP</span>
          <span className="badge">실행 가능한 인증/업로드/AI UX</span>
          <h1 className="h1" style={{ marginTop: 14 }}>내 말 기반 영어훈련 앱</h1>
          <p className="muted" style={{ marginTop: 12 }}>
            로그인 후 녹음 파일 업로드, STT 전사, 영어 표현 생성, TTS 재생, 말하기 테스트까지 한 화면에서 흐름을 확인할 수 있습니다.
          </p>
          <div className="grid feature-list" style={{ marginTop: 18 }}>
            <div className="mini-card"><strong>1. JWT 로그인</strong><div className="muted">토큰 저장 후 보호 API 호출</div></div>
            <div className="mini-card"><strong>2. 녹음 업로드</strong><div className="muted">S3 presigned upload 흐름</div></div>
            <div className="mini-card"><strong>3. AI 학습</strong><div className="muted">STT / LLM / TTS 연결</div></div>
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

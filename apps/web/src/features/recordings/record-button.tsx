"use client";

import { useState } from "react";

export function RecordButton() {
  const [recording, setRecording] = useState(false);
  return (
    <button
      className="rounded-2xl bg-black px-4 py-2 text-white"
      onClick={() => setRecording((v) => !v)}
    >
      {recording ? "녹음 중지" : "녹음 시작"}
    </button>
  );
}

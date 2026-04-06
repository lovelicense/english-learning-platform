"use client";

export type RecordingSessionOptions = {
  durationMs?: number;
  onLevel?: (level: number) => void;
  onTick?: (remainingMs: number, elapsedMs: number) => void;
};

export type RecordingSession = {
  promise: Promise<File>;
  stop: () => void;
  cancel: () => void;
};

export type ChunkedRecordingSessionOptions = {
  chunkDurationMs: number;
  maxDurationMs: number;
  onLevel?: (level: number) => void;
  onTick?: (remainingMs: number, elapsedMs: number) => void;
  onChunk?: (file: File, chunkIndex: number) => Promise<void> | void;
};

export type ChunkedRecordingSession = {
  completion: Promise<{ chunkCount: number; elapsedMs: number }>;
  stop: () => void;
  cancel: () => void;
};

function getPreferredAudioMimeType() {
  return (
    (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') && 'audio/webm;codecs=opus') ||
    (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2') && 'audio/mp4;codecs=mp4a.40.2') ||
    (MediaRecorder.isTypeSupported('audio/webm') && 'audio/webm') ||
    (MediaRecorder.isTypeSupported('audio/mp4') && 'audio/mp4') ||
    ''
  );
}

function getAudioFileExtension(mimeType: string) {
  return mimeType.includes('mp4') || mimeType.includes('m4a')
    ? 'm4a'
    : mimeType.includes('mpeg') || mimeType.includes('mp3')
    ? 'mp3'
    : mimeType.includes('wav')
    ? 'wav'
    : 'webm';
}

export function startRecordedAudioSession(options: RecordingSessionOptions = {}): RecordingSession {
  const durationMs = options.durationMs ?? 4000;
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let rafId = 0;
  let timeoutId = 0;
  let tickId = 0;
  let done = false;
  let startedAt = Date.now();
  let rejectFn: ((reason?: unknown) => void) | null = null;
  const chunks: BlobPart[] = [];

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) window.clearTimeout(timeoutId);
    if (tickId) window.clearInterval(tickId);
    try { source?.disconnect(); } catch {}
    try { analyser?.disconnect(); } catch {}
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => undefined);
    }
    stream?.getTracks().forEach((track) => track.stop());
    options.onLevel?.(0);
    options.onTick?.(0, Math.max(0, Date.now() - startedAt));
  };

  const promise = new Promise<File>(async (resolve, reject) => {
    rejectFn = reject;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getPreferredAudioMimeType();
      mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      startedAt = Date.now();

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const pumpLevel = () => {
        if (!analyser || done) return;
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        options.onLevel?.(Math.max(0, Math.min(1, rms * 4)));
        rafId = requestAnimationFrame(pumpLevel);
      };

      tickId = window.setInterval(() => {
        if (done) return;
        const elapsed = Math.max(0, Date.now() - startedAt);
        const remaining = Math.max(0, durationMs - elapsed);
        options.onTick?.(remaining, elapsed);
      }, 100);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('녹음 중 오류가 발생했습니다.'));
      };

      mediaRecorder.onstop = () => {
        if (done) return;
        done = true;
        cleanup();
        const actualMimeType =
          mediaRecorder?.mimeType ||
          chunks.find((chunk): chunk is Blob => chunk instanceof Blob && Boolean(chunk.type))?.type ||
          preferredMimeType ||
          'audio/webm';
        const blob = new Blob(chunks, { type: actualMimeType });
        if (blob.size === 0) {
          reject(new Error('녹음된 오디오 데이터가 비어 있습니다. 다시 녹음해 주세요.'));
          return;
        }
        const ext = getAudioFileExtension(actualMimeType);
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: actualMimeType });
        resolve(file);
      };

      mediaRecorder.start();
      options.onTick?.(durationMs, 0);
      pumpLevel();
      timeoutId = window.setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      }, durationMs);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('마이크 권한 또는 녹음 초기화에 실패했습니다.'));
    }
  });

  return {
    promise,
    stop: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    },
    cancel: () => {
      if (done) return;
      done = true;
      cleanup();
      try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch {}
      rejectFn?.(new Error('사용자가 녹음을 취소했습니다.'));
    },
  };
}

export async function createRecordedAudioFile(durationMs = 4000): Promise<File> {
  return startRecordedAudioSession({ durationMs }).promise;
}

export function startChunkedRecordedAudioSession(options: ChunkedRecordingSessionOptions): ChunkedRecordingSession {
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let rafId = 0;
  let timeoutId = 0;
  let tickId = 0;
  let done = false;
  let startedAt = Date.now();
  let rejectFn: ((reason?: unknown) => void) | null = null;
  let chunkCount = 0;
  let chunkQueue = Promise.resolve();

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) window.clearTimeout(timeoutId);
    if (tickId) window.clearInterval(tickId);
    try { source?.disconnect(); } catch {}
    try { analyser?.disconnect(); } catch {}
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => undefined);
    }
    stream?.getTracks().forEach((track) => track.stop());
    options.onLevel?.(0);
    options.onTick?.(0, Math.max(0, Date.now() - startedAt));
  };

  const completion = new Promise<{ chunkCount: number; elapsedMs: number }>(async (resolve, reject) => {
    rejectFn = reject;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getPreferredAudioMimeType();
      mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      startedAt = Date.now();

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const pumpLevel = () => {
        if (!analyser || done) return;
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        options.onLevel?.(Math.max(0, Math.min(1, rms * 4)));
        rafId = requestAnimationFrame(pumpLevel);
      };

      tickId = window.setInterval(() => {
        if (done) return;
        const elapsed = Math.max(0, Date.now() - startedAt);
        const remaining = Math.max(0, options.maxDurationMs - elapsed);
        options.onTick?.(remaining, elapsed);
      }, 100);

      mediaRecorder.ondataavailable = (event) => {
        if (done || event.data.size === 0) return;
        const actualMimeType = event.data.type || mediaRecorder?.mimeType || preferredMimeType || 'audio/webm';
        const ext = getAudioFileExtension(actualMimeType);
        const nextChunkIndex = chunkCount + 1;
        const file = new File([event.data], `recording-${Date.now()}-part-${String(nextChunkIndex).padStart(2, '0')}.${ext}`, {
          type: actualMimeType,
        });
        chunkCount = nextChunkIndex;
        chunkQueue = chunkQueue
          .then(() => options.onChunk?.(file, nextChunkIndex))
          .catch(() => undefined);
      };

      mediaRecorder.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('녹음 중 오류가 발생했습니다.'));
      };

      mediaRecorder.onstop = () => {
        if (done) return;
        done = true;
        chunkQueue
          .catch(() => undefined)
          .finally(() => {
            const elapsed = Math.max(0, Date.now() - startedAt);
            cleanup();
            resolve({ chunkCount, elapsedMs: elapsed });
          });
      };

      mediaRecorder.start(options.chunkDurationMs);
      options.onTick?.(options.maxDurationMs, 0);
      pumpLevel();
      timeoutId = window.setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      }, options.maxDurationMs);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('마이크 권한 또는 녹음 초기화에 실패했습니다.'));
    }
  });

  return {
    completion,
    stop: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    },
    cancel: () => {
      if (done) return;
      done = true;
      cleanup();
      try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch {}
      rejectFn?.(new Error('사용자가 녹음을 취소했습니다.'));
    },
  };
}

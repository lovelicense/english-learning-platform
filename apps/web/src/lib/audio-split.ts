"use client";

export type PreparedAudioChunk = {
  file: File;
  durationMs: number;
  partNumber: number;
};

const WAV_PCM_FORMAT = 1;
const WAV_BITS_PER_SAMPLE = 16;

function sanitizeBaseName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  startFrame: number,
  endFrame: number,
) {
  const frameCount = Math.max(0, endFrame - startFrame);
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const blockAlign = channelCount * (WAV_BITS_PER_SAMPLE / 8);
  const byteRate = sampleRate * blockAlign;
  const dataLength = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, WAV_PCM_FORMAT, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel]?.[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function decodeAudioFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("이 브라우저는 긴 음성 파일 자동 분할을 지원하지 않습니다.");
  }

  const audioContext = new AudioContextClass();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return decoded;
  } catch {
    throw new Error("이 오디오 파일은 브라우저에서 자동 분할할 수 없습니다. WAV/M4A/MP3 형식으로 다시 시도해 주세요.");
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

export async function prepareAudioChunksForUpload(
  file: File,
  maxChunkDurationMs: number,
): Promise<{ durationMs: number; chunks: PreparedAudioChunk[] }> {
  const decoded = await decodeAudioFile(file);
  const totalDurationMs = Math.round(decoded.duration * 1000);
  if (totalDurationMs <= maxChunkDurationMs) {
    return {
      durationMs: totalDurationMs,
      chunks: [{ file, durationMs: totalDurationMs, partNumber: 1 }],
    };
  }

  const baseName = sanitizeBaseName(file.name);
  const framesPerChunk = Math.max(1, Math.floor((maxChunkDurationMs / 1000) * decoded.sampleRate));
  const totalFrames = decoded.length;
  const chunks: PreparedAudioChunk[] = [];

  let startFrame = 0;
  let partNumber = 1;
  while (startFrame < totalFrames) {
    const endFrame = Math.min(totalFrames, startFrame + framesPerChunk);
    const blob = encodeAudioBufferToWav(decoded, startFrame, endFrame);
    const durationMs = Math.round(((endFrame - startFrame) / decoded.sampleRate) * 1000);
    chunks.push({
      file: new File([blob], `${baseName}-part-${String(partNumber).padStart(2, "0")}.wav`, { type: "audio/wav" }),
      durationMs,
      partNumber,
    });
    startFrame = endFrame;
    partNumber += 1;
  }

  return { durationMs: totalDurationMs, chunks };
}

export async function transcribeAudio(audioUrl: string) {
  return {
    audioUrl,
    utterances: [
      { speakerLabel: "speaker_1", startMs: 0, endMs: 1800, text: "나 지금 애 데리러 가는 중이야" },
    ],
  };
}

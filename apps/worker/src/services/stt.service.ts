export class SttService {
  async transcribe(recordingId: string) {
    return {
      recordingId,
      utterances: [
        { speakerLabel: "speaker_1", koreanText: "나 지금 애 데리러 가는 중이야" },
      ],
    };
  }
}

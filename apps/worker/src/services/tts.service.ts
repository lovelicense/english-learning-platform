export class TtsService {
  async synthesize(text: string) {
    return { audioKey: `tts/${Date.now()}.mp3`, text };
  }
}

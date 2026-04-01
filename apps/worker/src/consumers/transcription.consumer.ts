import { TranscriptionHandler } from "../handlers/transcription.handler.js";

export class TranscriptionConsumer {
  private readonly handler = new TranscriptionHandler();

  start() {
    console.log("worker started");
    void this.handler.handle({ recordingId: "rec_demo_1" });
  }
}

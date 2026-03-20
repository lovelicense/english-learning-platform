import { SttService } from "../services/stt.service";

export class TranscriptionHandler {
  private readonly sttService = new SttService();

  async handle(job: { recordingId: string }) {
    const result = await this.sttService.transcribe(job.recordingId);
    console.log("transcription finished", result);
  }
}

import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class QueueProducer {
  private readonly logger = new Logger(QueueProducer.name);

  async enqueueTranscriptionJob(payload: { recordingId: string }) {
    this.logger.log(`enqueue transcription job: ${payload.recordingId}`);
  }
}

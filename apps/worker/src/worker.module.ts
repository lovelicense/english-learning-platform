import { TranscriptionConsumer } from "./consumers/transcription.consumer";

export function startWorker() {
  const consumer = new TranscriptionConsumer();
  consumer.start();
}

import { TranscriptionConsumer } from "./consumers/transcription.consumer.js";

export function startWorker() {
  const consumer = new TranscriptionConsumer();
  consumer.start();
}

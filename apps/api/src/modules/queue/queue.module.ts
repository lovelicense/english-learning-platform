import { Module } from "@nestjs/common";
import { QueueProducer } from "./producers/queue.producer";

@Module({
  providers: [QueueProducer],
  exports: [QueueProducer],
})
export class QueueModule {}

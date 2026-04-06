import { Module } from '@nestjs/common';
import { RecordingSessionsController } from './recording-sessions.controller';
import { RecordingSessionsService } from './recording-sessions.service';

@Module({
  controllers: [RecordingSessionsController],
  providers: [RecordingSessionsService],
  exports: [RecordingSessionsService],
})
export class RecordingSessionsModule {}

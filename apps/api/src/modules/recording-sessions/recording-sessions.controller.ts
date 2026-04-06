import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteRecordingSessionPartDto } from './dto/complete-recording-session-part.dto';
import { CreateRecordingSessionPartPresignDto } from './dto/create-recording-session-part-presign.dto';
import { CreateRecordingSessionDto } from './dto/create-recording-session.dto';
import { FinalizeRecordingSessionDto } from './dto/finalize-recording-session.dto';
import { ProcessRecordingSessionDto } from './dto/process-recording-session.dto';
import { RecordingSessionsService } from './recording-sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('recording-sessions')
export class RecordingSessionsController {
  constructor(private readonly recordingSessionsService: RecordingSessionsService) {}

  @Post()
  createSession(@CurrentUser('userId') userId: string, @Body() dto: CreateRecordingSessionDto) {
    return this.recordingSessionsService.createSession(userId, dto);
  }

  @Post(':id/parts/presign')
  createPartPresign(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: CreateRecordingSessionPartPresignDto,
  ) {
    return this.recordingSessionsService.createPartPresign(userId, sessionId, dto);
  }

  @Post(':id/parts/:partId/complete')
  completePart(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Param('partId') partId: string,
    @Body() dto: CompleteRecordingSessionPartDto,
  ) {
    return this.recordingSessionsService.completePart(userId, sessionId, partId, dto);
  }

  @Post(':id/finalize')
  finalizeSession(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: FinalizeRecordingSessionDto,
  ) {
    return this.recordingSessionsService.finalizeSession(userId, sessionId, dto);
  }

  @Post(':id/process')
  enqueueProcessing(
    @CurrentUser('userId') userId: string,
    @Param('id') sessionId: string,
    @Body() dto: ProcessRecordingSessionDto,
  ) {
    return this.recordingSessionsService.enqueueProcessing(userId, sessionId, dto);
  }

  @Get(':id')
  getSession(@CurrentUser('userId') userId: string, @Param('id') sessionId: string) {
    return this.recordingSessionsService.getSession(userId, sessionId);
  }
}

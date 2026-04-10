import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyzeRecordingDto } from './dto/analyze-recording.dto';
import { CreatePresignDto } from './dto/create-presign.dto';
import { ProcessRecordingDto } from './dto/process-recording.dto';
import { UpdateRecordingParticipantsDto } from './dto/update-recording-participants.dto';
import { RemoveUtteranceDto } from './dto/remove-utterance.dto';
import { UpdateRecordingAnalysisStatusDto } from './dto/update-recording-analysis-status.dto';
import { UpdateRecordingSpeakerProfileDto } from './dto/update-recording-speaker-profile.dto';
import { UpdateRecordingSpeakerLabelDto } from './dto/update-recording-speaker-label.dto';
import { UpdateRecordingSpeakerDto } from './dto/update-recording-speaker.dto';
import { UpdateUtteranceDto } from './dto/update-utterance.dto';
import { RecordingsService } from './recordings.service';

@UseGuards(JwtAuthGuard)
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('presign')
  presign(@CurrentUser('userId') userId: string, @Body() dto: CreatePresignDto) {
    return this.recordingsService.createPresignedUpload(userId, dto.fileName, dto.contentType);
  }

  @Post(':id/process')
  process(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: ProcessRecordingDto) {
    return this.recordingsService.processRecording(userId, id, dto.diarization ?? false);
  }

  @Post(':id/analyze')
  analyze(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: AnalyzeRecordingDto) {
    return this.recordingsService.analyzeConversation(userId, id, dto);
  }

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.recordingsService.list(userId);
  }

  @Get(':id')
  getOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.recordingsService.getOne(userId, id);
  }

  @Patch('utterances/:utteranceId')
  updateUtterance(
    @CurrentUser('userId') userId: string,
    @Param('utteranceId') utteranceId: string,
    @Body() dto: UpdateUtteranceDto,
  ) {
    return this.recordingsService.updateUtterance(userId, utteranceId, dto);
  }

  @Delete('utterances/:utteranceId')
  removeUtterance(
    @CurrentUser('userId') userId: string,
    @Param('utteranceId') utteranceId: string,
    @Body() dto: RemoveUtteranceDto,
  ) {
    return this.recordingsService.removeUtterance(userId, utteranceId, dto.markAnalysisReview ?? true);
  }

  @Patch(':id/mine-speaker')
  updateMineSpeaker(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingSpeakerDto,
  ) {
    return this.recordingsService.updateMineSpeaker(userId, id, dto.speakerLabel);
  }

  @Patch(':id/speaker-label')
  updateSpeakerLabel(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingSpeakerLabelDto,
  ) {
    return this.recordingsService.updateSpeakerLabel(userId, id, dto.speakerLabel, dto.nextSpeakerLabel);
  }

  @Patch(':id/analysis-status')
  updateAnalysisStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingAnalysisStatusDto,
  ) {
    return this.recordingsService.updateAnalysisStatus(userId, id, dto.status, dto.reason);
  }

  @Patch(':id/participants')
  updateParticipants(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingParticipantsDto,
  ) {
    return this.recordingsService.updateParticipants(userId, id, dto.personProfileIds ?? []);
  }

  @Patch(':id/speaker-profile')
  updateSpeakerProfile(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingSpeakerProfileDto,
  ) {
    return this.recordingsService.updateSpeakerProfile(userId, id, dto.speakerLabel, dto.personProfileId);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.recordingsService.remove(userId, id);
  }
}

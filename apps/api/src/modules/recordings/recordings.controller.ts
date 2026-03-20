import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePresignDto } from './dto/create-presign.dto';
import { ProcessRecordingDto } from './dto/process-recording.dto';
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

  @Get(':id')
  getOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.recordingsService.getOne(userId, id);
  }
}

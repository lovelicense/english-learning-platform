import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePracticePresignDto, GeneratePracticePromptDto, ScorePracticeDto, ScoreVoicePracticeDto } from './dto/score-practice.dto';
import { PracticeService } from './practice.service';

@UseGuards(JwtAuthGuard)
@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('logs')
  listLogs(@CurrentUser('userId') userId: string, @Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    return this.practiceService.listLogs(
      userId,
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    );
  }

  @Post('prompts')
  generatePrompt(@CurrentUser('userId') userId: string, @Body() dto: GeneratePracticePromptDto) {
    return this.practiceService.generatePrompt(userId, dto.expressionId, dto.testType);
  }

  @Post('score')
  score(@CurrentUser('userId') userId: string, @Body() dto: ScorePracticeDto) {
    return this.practiceService.score(
      userId,
      dto.expressionId,
      dto.answer,
      dto.testType,
      dto.promptKorean,
      dto.promptContext,
      dto.promptTarget,
      dto.promptTargetAlt,
      dto.promptReferenceTarget,
      dto.promptPatternLabel,
      dto.promptPatternDescription,
      dto.promptReadyAtMs,
      dto.responseStartedAtMs,
    );
  }

  @Post('voice/presign')
  presignVoiceUpload(@Body() dto: CreatePracticePresignDto) {
    return this.practiceService.createVoicePresignedUpload(dto.fileName, dto.contentType);
  }

  @Post('score-voice')
  scoreVoice(@CurrentUser('userId') userId: string, @Body() dto: ScoreVoicePracticeDto) {
    return this.practiceService.scoreVoice(
      userId,
      dto.expressionId,
      dto.audioKey,
      dto.fileName,
      dto.testType,
      dto.promptKorean,
      dto.promptContext,
      dto.promptTarget,
      dto.promptTargetAlt,
      dto.promptReferenceTarget,
      dto.promptPatternLabel,
      dto.promptPatternDescription,
      dto.promptReadyAtMs,
      dto.responseStartedAtMs,
    );
  }
}

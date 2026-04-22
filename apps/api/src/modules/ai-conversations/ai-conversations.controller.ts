import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiConversationsService } from './ai-conversations.service';
import { CreateConversationSessionDto } from './dto/create-session.dto';
import { RespondConversationDto } from './dto/respond-conversation.dto';
import { TranscribeConversationAudioDto } from './dto/transcribe-conversation-audio.dto';
import { UpdateConversationSessionTitleDto } from './dto/update-session-title.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai-conversations')
export class AiConversationsController {
  constructor(private readonly aiConversationsService: AiConversationsService) {}

  @Get('sessions')
  list(@CurrentUser('userId') userId: string, @Query('mode') mode?: 'ENGLISH_AI' | 'KOREAN_AI') {
    return this.aiConversationsService.list(userId, mode);
  }

  @Get('dialogue-practice-sets')
  listDialoguePracticeSets(@CurrentUser('userId') userId: string) {
    return this.aiConversationsService.listDialoguePracticeSets(userId);
  }

  @Patch('dialogue-practice-sets/:id/title')
  updateDialoguePracticeSetTitle(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdateConversationSessionTitleDto) {
    return this.aiConversationsService.updateDialoguePracticeSetTitle(userId, id, dto.title);
  }

  @Get('sessions/:id')
  getOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.aiConversationsService.getOne(userId, id);
  }

  @Patch('sessions/:id/title')
  updateTitle(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdateConversationSessionTitleDto) {
    return this.aiConversationsService.updateTitle(userId, id, dto.title);
  }

  @Post('sessions')
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateConversationSessionDto) {
    return this.aiConversationsService.createSession(userId, dto);
  }

  @Post('sessions/:id/dialogue-practice')
  createDialoguePracticeSet(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.aiConversationsService.createDialoguePracticeSet(userId, id);
  }

  @Post('respond')
  respond(@CurrentUser('userId') userId: string, @Body() dto: RespondConversationDto) {
    return this.aiConversationsService.respond(userId, dto);
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  transcribe(@Body() dto: TranscribeConversationAudioDto, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined) {
    return this.aiConversationsService.transcribeAudio(dto.language, file);
  }

  @Post('turns/:id/save-expression')
  saveEnglishTurnAsExpression(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.aiConversationsService.saveEnglishTurnAsExpression(userId, id);
  }

  @Post('turns/:id/save-sentence/generate-expression')
  saveKoreanTurnAndGenerateExpression(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.aiConversationsService.saveKoreanTurnAndGenerateExpression(userId, id);
  }
}

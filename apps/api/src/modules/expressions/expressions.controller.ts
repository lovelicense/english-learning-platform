import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackfillThinkInEnglishDto } from './dto/backfill-think-in-english.dto';
import { GenerateExpressionDto } from './dto/generate-expression.dto';
import { GenerateRecordingExpressionsDto } from './dto/generate-recording-expressions.dto';
import { GenerateRecordingTtsDto } from './dto/generate-recording-tts.dto';
import { SavePracticeExpressionDto } from './dto/save-practice-expression.dto';
import { UpdateExpressionMemoDto } from './dto/update-expression-memo.dto';
import { ExpressionsService } from './expressions.service';

@UseGuards(JwtAuthGuard)
@Controller('expressions')
export class ExpressionsController {
  constructor(private readonly expressionsService: ExpressionsService) {}

  @Post('generate')
  generate(@CurrentUser('userId') userId: string, @Body() dto: GenerateExpressionDto) {
    return this.expressionsService.generate(userId, dto);
  }

  @Post('save-practice')
  savePracticeExpression(@CurrentUser('userId') userId: string, @Body() dto: SavePracticeExpressionDto) {
    return this.expressionsService.savePracticeExpression(userId, dto);
  }

  @Post('generate/bulk')
  generateForRecording(@CurrentUser('userId') userId: string, @Body() dto: GenerateRecordingExpressionsDto) {
    return this.expressionsService.generateForRecording(userId, dto);
  }

  @Post('tts/bulk')
  generateRecordingTts(@CurrentUser('userId') userId: string, @Body() dto: GenerateRecordingTtsDto) {
    return this.expressionsService.generateTtsForRecording(userId, dto.recordingId, dto.onlyMissing ?? true);
  }

  @Post('think-in-english/backfill')
  backfillThinkInEnglish(@CurrentUser('userId') userId: string, @Body() dto: BackfillThinkInEnglishDto) {
    return this.expressionsService.backfillThinkInEnglish(userId, dto.onlyMissing ?? true);
  }

  @Post(':id/tts')
  generateTts(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.expressionsService.generateTts(userId, id);
  }

  @Patch(':id/memo')
  updateMemo(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdateExpressionMemoDto) {
    return this.expressionsService.updateMemo(userId, id, dto.userMemo);
  }

  @Post(':id/refresh-study-aids')
  refreshStudyAids(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.expressionsService.refreshStudyAids(userId, id);
  }

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.expressionsService.list(userId);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.expressionsService.remove(userId, id);
  }
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScorePracticeDto } from './dto/score-practice.dto';
import { PracticeService } from './practice.service';

@UseGuards(JwtAuthGuard)
@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('score')
  score(@CurrentUser('userId') userId: string, @Body() dto: ScorePracticeDto) {
    return this.practiceService.score(userId, dto.expressionId, dto.answer);
  }
}

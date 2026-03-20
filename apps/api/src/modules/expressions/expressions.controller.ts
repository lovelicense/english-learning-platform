import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateExpressionDto } from './dto/generate-expression.dto';
import { ExpressionsService } from './expressions.service';

@UseGuards(JwtAuthGuard)
@Controller('expressions')
export class ExpressionsController {
  constructor(private readonly expressionsService: ExpressionsService) {}

  @Post('generate')
  generate(@CurrentUser('userId') userId: string, @Body() dto: GenerateExpressionDto) {
    return this.expressionsService.generate(userId, dto);
  }

  @Post(':id/tts')
  generateTts(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.expressionsService.generateTts(userId, id);
  }

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.expressionsService.list(userId);
  }
}

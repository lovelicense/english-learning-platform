import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LearningAssetsService } from './learning-assets.service';

@UseGuards(JwtAuthGuard)
@Controller('learning-assets')
export class LearningAssetsController {
  constructor(private readonly learningAssetsService: LearningAssetsService) {}

  @Get('progress')
  getProgress(@CurrentUser('userId') userId: string) {
    return this.learningAssetsService.getProgress(userId);
  }

  @Get('catalog')
  getCatalog(@CurrentUser('userId') userId: string) {
    return this.learningAssetsService.getCatalog(userId);
  }
}

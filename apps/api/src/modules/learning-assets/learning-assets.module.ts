import { Module } from '@nestjs/common';
import { LearningAssetsController } from './learning-assets.controller';
import { LearningAssetsService } from './learning-assets.service';

@Module({
  controllers: [LearningAssetsController],
  providers: [LearningAssetsService],
  exports: [LearningAssetsService],
})
export class LearningAssetsModule {}

import { Module } from '@nestjs/common';
import { ExpressionsController } from './expressions.controller';
import { ExpressionsService } from './expressions.service';
import { LearningAssetsModule } from '../learning-assets/learning-assets.module';

@Module({
  imports: [LearningAssetsModule],
  controllers: [ExpressionsController],
  providers: [ExpressionsService],
  exports: [ExpressionsService],
})
export class ExpressionsModule {}

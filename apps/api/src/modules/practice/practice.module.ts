import { Module } from '@nestjs/common';
import { OpenAiModule } from '../openai/openai.module';
import { LearningAssetsModule } from '../learning-assets/learning-assets.module';
import { StorageModule } from '../storage/storage.module';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [OpenAiModule, StorageModule, LearningAssetsModule],
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}

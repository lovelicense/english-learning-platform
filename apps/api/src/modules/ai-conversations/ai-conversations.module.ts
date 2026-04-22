import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ExpressionsModule } from '../expressions/expressions.module';
import { LearningAssetsModule } from '../learning-assets/learning-assets.module';
import { OpenAiModule } from '../openai/openai.module';
import { StorageModule } from '../storage/storage.module';
import { AiConversationsController } from './ai-conversations.controller';
import { AiConversationsService } from './ai-conversations.service';

@Module({
  imports: [DbModule, OpenAiModule, StorageModule, ExpressionsModule, LearningAssetsModule],
  controllers: [AiConversationsController],
  providers: [AiConversationsService],
})
export class AiConversationsModule {}

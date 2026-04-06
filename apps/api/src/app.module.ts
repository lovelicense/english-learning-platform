import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DbModule } from './modules/db/db.module';
import { ExpressionsModule } from './modules/expressions/expressions.module';
import { HealthModule } from './modules/health/health.module';
import { OpenAiModule } from './modules/openai/openai.module';
import { PracticeModule } from './modules/practice/practice.module';
import { RecordingSessionsModule } from './modules/recording-sessions/recording-sessions.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    StorageModule,
    OpenAiModule,
    UsersModule,
    AuthModule,
    HealthModule,
    RecordingSessionsModule,
    RecordingsModule,
    ExpressionsModule,
    PracticeModule,
    ReviewsModule,
  ],
})
export class AppModule {}

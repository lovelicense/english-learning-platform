import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RecordingSource } from '@prisma/client';

export class CreateRecordingSessionDto {
  @IsEnum(RecordingSource)
  source!: RecordingSource;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

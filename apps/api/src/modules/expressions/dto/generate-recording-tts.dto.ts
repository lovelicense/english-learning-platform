import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateRecordingTtsDto {
  @IsString()
  recordingId!: string;

  @IsOptional()
  @IsBoolean()
  onlyMissing?: boolean;
}

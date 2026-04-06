import { IsInt, IsOptional, Min } from 'class-validator';

export class FinalizeRecordingSessionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedPartCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalDurationMs?: number;
}

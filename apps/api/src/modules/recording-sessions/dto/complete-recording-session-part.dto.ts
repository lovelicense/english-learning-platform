import { IsInt, IsOptional, Min } from 'class-validator';

export class CompleteRecordingSessionPartDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

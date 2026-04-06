import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRecordingSessionPartPresignDto {
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class GenerateRecordingExpressionsDto {
  @IsString()
  recordingId!: string;

  @IsOptional()
  @IsIn(['mine', 'others', 'all'])
  speakerScope?: 'mine' | 'others' | 'all';

  @IsOptional()
  @IsBoolean()
  includeExisting?: boolean;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class AnalyzeRecordingDto {
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

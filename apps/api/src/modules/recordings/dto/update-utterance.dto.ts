import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUtteranceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  koreanText?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  speakerLabel?: string;

  @IsOptional()
  @IsString()
  contextNote?: string;

  @IsOptional()
  @IsBoolean()
  markAnalysisReview?: boolean;
}

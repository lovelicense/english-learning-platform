import { IsArray, IsOptional, IsString } from 'class-validator';

export class GenerateExpressionDto {
  @IsOptional()
  @IsString()
  utteranceId?: string;

  @IsOptional()
  @IsString()
  savedSentenceId?: string;

  @IsOptional()
  @IsString()
  koreanText?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personProfileIds?: string[];
}

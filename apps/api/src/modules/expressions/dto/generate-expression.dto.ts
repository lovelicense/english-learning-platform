import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateExpressionDto {
  @IsOptional()
  @IsString()
  utteranceId?: string;

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
}

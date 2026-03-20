import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateExpressionDto {
  @IsOptional()
  @IsString()
  utteranceId?: string;

  @IsOptional()
  @IsString()
  koreanText?: string;
}

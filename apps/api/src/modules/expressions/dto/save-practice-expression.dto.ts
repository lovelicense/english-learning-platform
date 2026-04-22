import { IsOptional, IsString, MinLength } from 'class-validator';

export class SavePracticeExpressionDto {
  @IsString()
  @MinLength(1)
  koreanText!: string;

  @IsString()
  @MinLength(1)
  englishBase!: string;

  @IsOptional()
  @IsString()
  englishEasy?: string;

  @IsOptional()
  @IsString()
  englishNatural?: string;

  @IsOptional()
  @IsString()
  thinkInEnglish?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  promptContext?: string;
}

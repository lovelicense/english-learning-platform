import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class GeneratePracticePromptDto {
  @IsString()
  @MinLength(1)
  expressionId!: string;

  @IsString()
  @IsIn(['translation', 'situation', 'pattern'])
  testType!: 'translation' | 'situation' | 'pattern';
}

export class ScorePracticeDto {
  @IsString()
  @MinLength(1)
  expressionId!: string;

  @IsString()
  answer!: string;

  @IsOptional()
  @IsString()
  @IsIn(['translation', 'situation', 'pattern'])
  testType?: 'translation' | 'situation' | 'pattern';

  @IsOptional()
  @IsString()
  promptKorean?: string;

  @IsOptional()
  @IsString()
  promptContext?: string;
}

export class CreatePracticePresignDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  contentType!: string;
}

export class ScoreVoicePracticeDto {
  @IsString()
  @MinLength(1)
  expressionId!: string;

  @IsString()
  @MinLength(1)
  audioKey!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  @IsIn(['translation', 'situation', 'pattern'])
  testType?: 'translation' | 'situation' | 'pattern';

  @IsOptional()
  @IsString()
  promptKorean?: string;

  @IsOptional()
  @IsString()
  promptContext?: string;
}

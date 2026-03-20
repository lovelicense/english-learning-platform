import { IsString, MinLength } from 'class-validator';

export class ScorePracticeDto {
  @IsString()
  @MinLength(1)
  expressionId!: string;

  @IsString()
  answer!: string;
}

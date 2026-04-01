import { IsString, MinLength } from 'class-validator';

export class UpdateUtteranceDto {
  @IsString()
  @MinLength(1)
  koreanText!: string;
}

import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateConversationTurnDto {
  @IsIn(['USER', 'AI'])
  speaker!: 'USER' | 'AI';

  @IsIn(['EN', 'KO', 'MIXED'])
  language!: 'EN' | 'KO' | 'MIXED';

  @IsString()
  text!: string;

  @IsOptional()
  @IsIn(['text', 'voice'])
  inputMode?: 'text' | 'voice';

  @IsOptional()
  @IsIn(['text', 'voice'])
  outputMode?: 'text' | 'voice';

  @IsOptional()
  @IsString()
  audioFileName?: string;
}

export class CreateConversationSessionDto {
  @IsIn(['ENGLISH_AI', 'KOREAN_AI'])
  mode!: 'ENGLISH_AI' | 'KOREAN_AI';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  scenario?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsIn(['text', 'voice'])
  aiOutputMode?: 'text' | 'voice';

  @IsOptional()
  @IsIn(['text', 'voice'])
  userInputMode?: 'text' | 'voice';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateConversationTurnDto)
  turns?: CreateConversationTurnDto[];
}

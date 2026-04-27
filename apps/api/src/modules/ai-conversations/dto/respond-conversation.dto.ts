import { IsIn, IsOptional, IsString } from 'class-validator';

export class RespondConversationDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsIn(['ENGLISH_AI', 'KOREAN_AI'])
  mode!: 'ENGLISH_AI' | 'KOREAN_AI';

  @IsIn(['text', 'voice'])
  aiOutputMode!: 'text' | 'voice';

  @IsIn(['text', 'voice'])
  userInputMode!: 'text' | 'voice';

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  userRole?: string;

  @IsOptional()
  @IsString()
  aiRole?: string;

  @IsOptional()
  @IsString()
  conversationTopic?: string;

  @IsOptional()
  @IsString()
  situationDescription?: string;

  @IsOptional()
  @IsString()
  userStartText?: string;
}

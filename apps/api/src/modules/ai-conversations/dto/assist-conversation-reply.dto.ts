import { IsOptional, IsString } from 'class-validator';

export class AssistConversationReplyDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  koreanText!: string;

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
}

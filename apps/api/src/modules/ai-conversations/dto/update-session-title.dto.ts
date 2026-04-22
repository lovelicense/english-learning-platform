import { IsString, MaxLength } from 'class-validator';

export class UpdateConversationSessionTitleDto {
  @IsString()
  @MaxLength(120)
  title!: string;
}

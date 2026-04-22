import { IsIn } from 'class-validator';

export class TranscribeConversationAudioDto {
  @IsIn(['en', 'ko'])
  language!: 'en' | 'ko';
}

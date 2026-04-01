import { IsString, MinLength } from 'class-validator';

export class UpdateRecordingSpeakerLabelDto {
  @IsString()
  @MinLength(1)
  speakerLabel!: string;

  @IsString()
  @MinLength(1)
  nextSpeakerLabel!: string;
}

import { IsString, MinLength } from 'class-validator';

export class UpdateRecordingSpeakerDto {
  @IsString()
  @MinLength(1)
  speakerLabel!: string;
}

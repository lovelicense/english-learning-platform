import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateRecordingSpeakerProfileDto {
  @IsString()
  @MinLength(1)
  speakerLabel!: string;

  @IsOptional()
  @IsString()
  personProfileId?: string;
}

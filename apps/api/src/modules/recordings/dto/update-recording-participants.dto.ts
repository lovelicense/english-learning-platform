import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateRecordingParticipantsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  personProfileIds?: string[];
}

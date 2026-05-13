import { IsString, MaxLength } from 'class-validator';

export class UpdateRecordingDisplayNameDto {
  @IsString()
  @MaxLength(120)
  displayName!: string;
}

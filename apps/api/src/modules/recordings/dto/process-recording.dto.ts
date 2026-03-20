import { IsBoolean, IsOptional } from 'class-validator';

export class ProcessRecordingDto {
  @IsOptional()
  @IsBoolean()
  diarization?: boolean;
}

import { IsBoolean, IsOptional } from 'class-validator';

export class ProcessRecordingSessionDto {
  @IsOptional()
  @IsBoolean()
  diarization?: boolean;
}

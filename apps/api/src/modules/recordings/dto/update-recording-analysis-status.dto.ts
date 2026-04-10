import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateRecordingAnalysisStatusDto {
  @IsIn(['OK', 'NEEDS_REVIEW'])
  status!: 'OK' | 'NEEDS_REVIEW';

  @IsOptional()
  @IsString()
  reason?: string;
}

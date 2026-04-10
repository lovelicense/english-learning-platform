import { IsBoolean, IsOptional } from 'class-validator';

export class RemoveUtteranceDto {
  @IsOptional()
  @IsBoolean()
  markAnalysisReview?: boolean;
}

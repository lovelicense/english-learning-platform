import { IsBoolean, IsOptional } from 'class-validator';

export class BackfillThinkInEnglishDto {
  @IsOptional()
  @IsBoolean()
  onlyMissing?: boolean;
}

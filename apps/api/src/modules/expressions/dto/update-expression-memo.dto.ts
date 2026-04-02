import { IsOptional, IsString } from 'class-validator';

export class UpdateExpressionMemoDto {
  @IsOptional()
  @IsString()
  userMemo?: string;
}

import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePresignDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

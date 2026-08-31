import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AuditLogQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: string }) => value.trim())
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: string }) => value.trim())
  targetType?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

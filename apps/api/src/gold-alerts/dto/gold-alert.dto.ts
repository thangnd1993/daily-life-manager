import { GoldAlertCondition, GoldAlertPriceSide } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateGoldAlertDto {
  @IsString()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsIn(['SJC', 'DOJI', 'PNJ'])
  productCode!: string;

  @IsEnum(GoldAlertPriceSide)
  priceSide!: GoldAlertPriceSide;

  @IsEnum(GoldAlertCondition)
  condition!: GoldAlertCondition;

  @ValidateIf((dto: CreateGoldAlertDto) => dto.condition !== 'PERCENT_CHANGE')
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/)
  thresholdAmount?: string;

  @ValidateIf((dto: CreateGoldAlertDto) => dto.condition === 'PERCENT_CHANGE')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  thresholdBasisPoints?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  cooldownMinutes = 60;
}

export class UpdateGoldAlertDto extends CreateGoldAlertDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class SetGoldAlertEnabledDto {
  @IsBoolean()
  isEnabled!: boolean;
}

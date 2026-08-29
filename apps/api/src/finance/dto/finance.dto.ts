import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Currency, FinanceTransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiProperty({ enum: FinanceTransactionType })
  @IsEnum(FinanceTransactionType)
  type!: FinanceTransactionType;
}

export class UpdateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  name!: string;
}

export class CreateTransactionDto {
  @ApiProperty({ enum: FinanceTransactionType })
  @IsEnum(FinanceTransactionType)
  type!: FinanceTransactionType;

  @ApiProperty({
    example: '150000',
    description: 'Positive integer VND serialized as a decimal string',
  })
  @IsString()
  @Matches(/^[1-9]\d{0,15}$/)
  amount!: string;

  @ApiProperty({ enum: Currency, default: Currency.VND })
  @IsEnum(Currency)
  currency: Currency = Currency.VND;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}

export class TransactionQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year =
    new Date().getUTCFullYear();
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month =
    new Date().getUTCMonth() + 1;
  @IsOptional() @IsEnum(FinanceTransactionType) type?: FinanceTransactionType;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

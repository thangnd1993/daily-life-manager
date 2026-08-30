import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class GoldHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 7, 30])
  days = 7;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 200;
}

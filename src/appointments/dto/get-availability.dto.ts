import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAvailabilityDto {
  @IsNumber()
  @Type(() => Number)
  doctorId: number;

  @IsString()
  @IsOptional()
  date?: string;
}

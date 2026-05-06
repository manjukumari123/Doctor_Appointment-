import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CancelAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  appointmentId?: number;

  @IsString()
  @IsOptional()
  patientPhone?: string;

  @IsString()
  @IsOptional()
  appointmentDate?: string;
}

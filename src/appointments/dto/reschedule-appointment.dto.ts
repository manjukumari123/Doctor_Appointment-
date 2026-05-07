import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RescheduleAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  appointmentId?: number;

  @IsString()
  @IsOptional()
  patientPhone?: string;

  @IsString()
  @IsOptional()
  oldAppointmentDate?: string;

  @IsString()
  newAppointmentDate: string;

  @IsNumber()
  @Type(() => Number)
  newSlotNumber: number;
}

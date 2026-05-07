import { IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BookAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  doctorId: number;

  @IsString()
  patientPhone: string;

  @IsString()
  patientName: string;

  @IsString()
  reasonForVisit: string;

  @IsString()
  appointmentDate: string;

  @IsNumber()
  @Type(() => Number)
  slotNumber: number;
}

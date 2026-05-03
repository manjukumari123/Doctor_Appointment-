import { IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsNumber()
  @Type(() => Number)
  doctorId: number;

  @IsNumber()
  @Type(() => Number)
  patientId: number;

  @IsString()
  date: string;
}

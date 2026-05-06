import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '../doctors/doctor.entity';
import { Patient } from '../patients/patient.entity';
import { Appointment } from '../appointments/appointment.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Doctor, Patient, Appointment]),
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class DatabaseModule {}

// appointment.entity.ts

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctorId: number;

  @Column()
  patientId: number;

  @Column({ type: 'date' })
  appointmentDate: string;

  @Column({ type: 'int' })
  slotNumber: number;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.BOOKED,
  })
  status: AppointmentStatus;
}

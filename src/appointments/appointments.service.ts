import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { Doctor } from '../doctors/doctor.entity';
import { Patient } from '../patients/patient.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private mailService: MailService,
  ) {}

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async getNextAvailableDates(
    doctorId: number,
    fromDate: string,
    totalSlots: number,
  ): Promise<string[]> {
    this.logger.debug(`Finding next available dates for doctor ${doctorId} from ${fromDate} (max 3 dates, ${totalSlots} slots each)`);
    const results: string[] = [];
    const current = new Date(fromDate);

    while (results.length < 3) {
      current.setDate(current.getDate() + 1);
      const dateStr = current.toISOString().split('T')[0];
      
      this.logger.debug(`Checking date: ${dateStr} (Day: ${current.getDay()})`);
      if (current.getDay() === 0) {
        this.logger.debug(`Skipping Sunday: ${dateStr}`);
        continue;
      }

      this.logger.debug(`Counting booked appointments for doctor ${doctorId} on ${dateStr}`);
      const count = await this.appointmentRepository.count({
        where: {
          doctorId: doctorId,
          appointmentDate: dateStr,
          status: AppointmentStatus.BOOKED,
        },
      });

      this.logger.debug(`Date ${dateStr}: ${count}/${totalSlots} slots booked`);
      if (count < totalSlots) {
        results.push(dateStr);
        this.logger.debug(`Added available date: ${dateStr}`);
      }
    }

    this.logger.debug(`Found ${results.length} available dates: [${results.join(', ')}]`);
    return results;
  }

  async bookAppointment(dto: CreateAppointmentDto) {
    this.logger.log(`Attempting to book appointment - Doctor ID: ${dto.doctorId}, Patient ID: ${dto.patientId}, Date: ${dto.date}`);
    
    // Step 1 - Sunday check
    this.logger.debug(`Checking if date ${dto.date} is a Sunday`);
    const date = new Date(dto.date);
    if (date.getDay() === 0) {
      this.logger.warn(`Appointment booking failed - Sunday not allowed for date: ${dto.date}`);
      return { message: 'Appointments are not available on Sundays' };
    }

    // Step 2 - Fetch doctor
    this.logger.debug(`Fetching doctor with ID: ${dto.doctorId}`);
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: dto.doctorId },
    });
    if (!doctor) {
      this.logger.warn(`Appointment booking failed - Doctor not found with ID: ${dto.doctorId}`);
      return { message: 'Doctor not found' };
    }
    this.logger.debug(`Found doctor: ${doctor.first_name} ${doctor.last_name} (${doctor.email})`);

    // Step 3 - Calculate total slots
    this.logger.debug(`Calculating total slots for doctor ${dto.doctorId}`);
    const totalSlots =
      (this.toMinutes(doctor.end_time) - this.toMinutes(doctor.start_time)) /
      doctor.slot_duration;
    this.logger.debug(`Doctor ${dto.doctorId} has ${totalSlots} total slots (Start: ${doctor.start_time}, End: ${doctor.end_time}, Duration: ${doctor.slot_duration}min)`);

    // Step 4 - Count booked appointments for this date
    this.logger.debug(`Counting booked appointments for doctor ${dto.doctorId} on ${dto.date}`);
    const bookedCount = await this.appointmentRepository.count({
      where: {
        doctorId: dto.doctorId,
        appointmentDate: dto.date,
        status: AppointmentStatus.BOOKED,
      },
    });
    this.logger.debug(`Found ${bookedCount} booked appointments out of ${totalSlots} total slots`);

    // Step 5 - If fully booked, email patient and return next 3 dates
    if (bookedCount >= totalSlots) {
      this.logger.warn(`All slots booked for doctor ${dto.doctorId} on ${dto.date}. Finding next available dates.`);
      const nextDates = await this.getNextAvailableDates(
        dto.doctorId,
        dto.date,
        totalSlots,
      );
      this.logger.debug(`Found next available dates: ${nextDates.join(', ')}`);

      this.logger.debug(`Fetching patient with ID: ${dto.patientId} for email notification`);
      const patient = await this.patientRepository.findOne({
        where: { patient_id: dto.patientId },
      });

      if (patient) {
        this.logger.debug(`Sending reschedule email to patient: ${patient.email}`);
        await this.mailService.sendRescheduleEmail(
          patient.email,
          patient.first_name,
          nextDates,
        );
        this.logger.log(`Reschedule email sent to patient ${dto.patientId}`);
      } else {
        this.logger.warn(`Patient not found with ID: ${dto.patientId} for email notification`);
      }

      return {
        message: 'No slots available. Next available dates sent to your email.',
        nextAvailableDates: nextDates,
      };
    }

    // Step 6 - Find next available slot number
    this.logger.debug(`Finding next available slot number for doctor ${dto.doctorId} on ${dto.date}`);
    const bookedSlots = await this.appointmentRepository.find({
      where: {
        doctorId: dto.doctorId,
        appointmentDate: dto.date,
        status: AppointmentStatus.BOOKED,
      },
      select: ['slotNumber'],
    });

    const takenSlotNumbers = bookedSlots.map((a) => a.slotNumber);
    this.logger.debug(`Taken slot numbers: [${takenSlotNumbers.join(', ')}]`);
    let nextSlot = 1;
    while (takenSlotNumbers.includes(nextSlot)) nextSlot++;
    this.logger.debug(`Next available slot number: ${nextSlot}`);

    // Step 7 - Calculate reporting time
    this.logger.debug(`Calculating reporting time for slot ${nextSlot}`);
    const startMinutes = this.toMinutes(doctor.start_time);
    const reportingMinutes =
      startMinutes + (nextSlot - 1) * doctor.slot_duration;
    const hours = Math.floor(reportingMinutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = (reportingMinutes % 60).toString().padStart(2, '0');
    const reportingTime = `${hours}:${mins}`;
    this.logger.debug(`Calculated reporting time: ${reportingTime}`);

    // Step 8 - Save appointment
    this.logger.debug(`Creating appointment record`);
    const appointment = this.appointmentRepository.create({
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      appointmentDate: dto.date,
      slotNumber: nextSlot,
      status: AppointmentStatus.BOOKED,
    });

    this.logger.debug(`Saving appointment to database`);
    const saved = await this.appointmentRepository.save(appointment);
    
    this.logger.log(`Appointment booked successfully - ID: ${saved.id}, Doctor: ${dto.doctorId}, Patient: ${dto.patientId}, Date: ${dto.date}, Slot: ${nextSlot}, Time: ${reportingTime}`);

    return {
      message: 'Appointment booked successfully!',
      token: nextSlot,
      reportingTime,
      appointment: saved,
    };
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

  async getAvailability(doctorId: number, date?: string) {
    this.logger.log(`Getting availability for doctor ${doctorId}${date ? ` on ${date}` : ' for today'}`);
    
    // If no date provided, use today's date
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Validate date is not Sunday
    const dateObj = new Date(targetDate);
    if (dateObj.getDay() === 0) {
      this.logger.warn(`Availability check failed - Sunday not allowed: ${targetDate}`);
      throw new BadRequestException('Appointments are not available on Sundays');
    }

    // Fetch doctor
    this.logger.debug(`Fetching doctor with ID: ${doctorId}`);
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: doctorId },
    });
    if (!doctor) {
      this.logger.warn(`Availability check failed - Doctor not found: ${doctorId}`);
      throw new BadRequestException('Doctor not found');
    }

    // Calculate total slots
    const totalSlots = Math.floor(
      (this.toMinutes(doctor.end_time) - this.toMinutes(doctor.start_time)) /
      doctor.slot_duration
    );
    this.logger.debug(`Doctor ${doctorId} has ${totalSlots} total slots`);

    // Count booked appointments
    const bookedCount = await this.appointmentRepository.count({
      where: {
        doctorId: doctorId,
        appointmentDate: targetDate,
        status: AppointmentStatus.BOOKED,
      },
    });
    this.logger.debug(`Found ${bookedCount} booked appointments for ${targetDate}`);

    const availableSlots = totalSlots - bookedCount;

    // Get all booked slots to determine which are available
    const bookedSlots = await this.appointmentRepository.find({
      where: {
        doctorId: doctorId,
        appointmentDate: targetDate,
        status: AppointmentStatus.BOOKED,
      },
      select: ['slotNumber'],
    });

    const takenSlotNumbers = bookedSlots.map((a) => a.slotNumber);

    // Generate all slots with availability status
    const slots: Array<{ slotNumber: number; time: string; available: boolean }> = [];
    for (let i = 1; i <= totalSlots; i++) {
      const slotMinutes = this.toMinutes(doctor.start_time) + (i - 1) * doctor.slot_duration;
      const hours = Math.floor(slotMinutes / 60).toString().padStart(2, '0');
      const mins = (slotMinutes % 60).toString().padStart(2, '0');
      
      slots.push({
        slotNumber: i,
        time: `${hours}:${mins}`,
        available: !takenSlotNumbers.includes(i),
      });
    }

    this.logger.log(`Availability retrieved for doctor ${doctorId} on ${targetDate}: ${availableSlots}/${totalSlots} available`);

    return {
      doctorId: doctorId,
      date: targetDate,
      totalSlots: totalSlots,
      bookedSlots: bookedCount,
      availableSlots: availableSlots,
      slots: slots,
    };
  }

  async bookAppointmentWithSlot(dto: any) {
    this.logger.log(`Booking appointment for doctor ${dto.doctorId}, phone: ${dto.patientPhone}, date: ${dto.date}, slot: ${dto.slotNumber}`);
    
    // Check for duplicate booking
    this.logger.debug(`Checking for duplicate booking with phone: ${dto.patientPhone} on ${dto.date}`);
    const existingAppointment = await this.appointmentRepository.findOne({
      where: {
        doctorId: dto.doctorId,
        appointmentDate: dto.appointmentDate,
        patientPhone: dto.patientPhone,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingAppointment) {
      this.logger.warn(`Duplicate booking attempt - phone ${dto.patientPhone} already has appointment on ${dto.appointmentDate}`);
      throw new BadRequestException('You already have an appointment booked for this date. Please cancel the existing appointment first.');
    }

    // Validate date is not Sunday
    const date = new Date(dto.appointmentDate);
    if (date.getDay() === 0) {
      this.logger.warn(`Booking failed - Sunday not allowed: ${dto.appointmentDate}`);
      throw new BadRequestException('Appointments are not available on Sundays');
    }

    // Fetch doctor
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: dto.doctorId },
    });
    if (!doctor) {
      this.logger.warn(`Booking failed - Doctor not found: ${dto.doctorId}`);
      throw new BadRequestException('Doctor not found');
    }

    // Calculate total slots
    const totalSlots = Math.floor(
      (this.toMinutes(doctor.end_time) - this.toMinutes(doctor.start_time)) /
      doctor.slot_duration
    );

    // Validate slot number
    if (dto.slotNumber < 1 || dto.slotNumber > totalSlots) {
      this.logger.warn(`Booking failed - Invalid slot number: ${dto.slotNumber} (valid: 1-${totalSlots})`);
      throw new BadRequestException(`Invalid slot number. Valid slots are 1 to ${totalSlots}`);
    }

    // Check if slot is already booked
    const existingSlot = await this.appointmentRepository.findOne({
      where: {
        doctorId: dto.doctorId,
        appointmentDate: dto.appointmentDate,
        slotNumber: dto.slotNumber,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingSlot) {
      this.logger.warn(`Booking failed - Slot ${dto.slotNumber} already booked on ${dto.appointmentDate}`);
      throw new BadRequestException('This slot is already booked. Please choose another slot.');
    }

    // Calculate reporting time
    const startMinutes = this.toMinutes(doctor.start_time);
    const reportingMinutes = startMinutes + (dto.slotNumber - 1) * doctor.slot_duration;
    const hours = Math.floor(reportingMinutes / 60).toString().padStart(2, '0');
    const mins = (reportingMinutes % 60).toString().padStart(2, '0');
    const reportingTime = `${hours}:${mins}`;

    // Save appointment
    const appointment = this.appointmentRepository.create({
      doctorId: dto.doctorId,
      patientId: 0, // Will be updated based on patient lookup if needed
      appointmentDate: dto.appointmentDate,
      slotNumber: dto.slotNumber,
      status: AppointmentStatus.BOOKED,
      patientPhone: dto.patientPhone,
      patientName: dto.patientName,
      reasonForVisit: dto.reasonForVisit,
    });

    const saved = await this.appointmentRepository.save(appointment);

    this.logger.log(`Appointment booked successfully - ID: ${saved.id}, Phone: ${dto.patientPhone}, Slot: ${dto.slotNumber}, Time: ${reportingTime}`);

    return {
      message: 'Appointment booked successfully',
      tokenNumber: dto.slotNumber,
      reportingTime: reportingTime,
      appointmentDate: dto.appointmentDate,
    };
  }

  async getNextAvailableDay(doctorId: number) {
    this.logger.log(`Finding next available appointment day for doctor ${doctorId}`);
    
    // Fetch doctor
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: doctorId },
    });
    if (!doctor) {
      this.logger.warn(`Next available check failed - Doctor not found: ${doctorId}`);
      throw new BadRequestException('Doctor not found');
    }

    const totalSlots = Math.floor(
      (this.toMinutes(doctor.end_time) - this.toMinutes(doctor.start_time)) /
      doctor.slot_duration
    );

    // Search for next 3 days
    const current = new Date();
    current.setDate(current.getDate() + 1); // Start from tomorrow

    for (let day = 0; day < 3; day++) {
      current.setDate(current.getDate() + 1);
      
      // Skip Sundays
      if (current.getDay() === 0) {
        this.logger.debug(`Skipping Sunday: ${current.toISOString().split('T')[0]}`);
        continue;
      }

      const dateStr = current.toISOString().split('T')[0];
      
      // Check availability
      const bookedCount = await this.appointmentRepository.count({
        where: {
          doctorId: doctorId,
          appointmentDate: dateStr,
          status: AppointmentStatus.BOOKED,
        },
      });

      if (bookedCount < totalSlots) {
        // Found available day, get available slots
        const bookedSlots = await this.appointmentRepository.find({
          where: {
            doctorId: doctorId,
            appointmentDate: dateStr,
            status: AppointmentStatus.BOOKED,
          },
          select: ['slotNumber'],
        });

        const takenSlotNumbers = bookedSlots.map((a) => a.slotNumber);
        const availableSlots: Array<{ slotNumber: number; time: string }> = [];

        for (let i = 1; i <= totalSlots; i++) {
          if (!takenSlotNumbers.includes(i)) {
            const slotMinutes = this.toMinutes(doctor.start_time) + (i - 1) * doctor.slot_duration;
            const hours = Math.floor(slotMinutes / 60).toString().padStart(2, '0');
            const mins = (slotMinutes % 60).toString().padStart(2, '0');
            
            availableSlots.push({
              slotNumber: i,
              time: `${hours}:${mins}`,
            });
          }
        }

        this.logger.log(`Found next available day: ${dateStr} with ${availableSlots.length} slots`);
        return {
          message: `Next available appointment is on ${dateStr}`,
          nextAvailableDate: dateStr,
          availableSlots: availableSlots,
        };
      }
    }

    this.logger.warn(`No available slots found in next 3 days for doctor ${doctorId}`);
    return {
      message: 'No appointments available in the next 3 days. Please try after sometime',
      nextAvailableDate: null,
      availableSlots: [],
    };
  }

  async cancelAppointment(dto: any) {
    this.logger.log(`Attempting to cancel appointment - ID: ${dto.appointmentId}, Phone: ${dto.patientPhone}, Date: ${dto.appointmentDate}`);
    
    let appointment: Appointment | null = null;

    // Cancel by appointment ID
    if (dto.appointmentId) {
      this.logger.debug(`Cancelling appointment by ID: ${dto.appointmentId}`);
      appointment = await this.appointmentRepository.findOne({
        where: { id: dto.appointmentId },
      });
      
      if (!appointment) {
        this.logger.warn(`Cancellation failed - Appointment not found with ID: ${dto.appointmentId}`);
        throw new BadRequestException('Appointment not found');
      }
    }
    // Cancel by patient phone and date
    else if (dto.patientPhone && dto.appointmentDate) {
      this.logger.debug(`Cancelling appointment by phone: ${dto.patientPhone} and date: ${dto.appointmentDate}`);
      appointment = await this.appointmentRepository.findOne({
        where: {
          patientPhone: dto.patientPhone,
          appointmentDate: dto.appointmentDate,
          status: AppointmentStatus.BOOKED,
        },
      });
      
      if (!appointment) {
        this.logger.warn(`Cancellation failed - No booked appointment found for phone: ${dto.patientPhone} on date: ${dto.appointmentDate}`);
        throw new BadRequestException('No active appointment found for this phone number on the given date');
      }
    }
    else {
      this.logger.warn(`Cancellation failed - Invalid request parameters`);
      throw new BadRequestException('Please provide either appointmentId or both patientPhone and appointmentDate');
    }

    // Check if already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      this.logger.warn(`Cancellation failed - Appointment already cancelled - ID: ${appointment.id}`);
      throw new BadRequestException('This appointment has already been cancelled');
    }

    this.logger.debug(`Cancelling appointment ID: ${appointment.id}`);
    appointment.status = AppointmentStatus.CANCELLED;
    
    this.logger.debug(`Saving cancelled appointment to database`);
    const cancelled = await this.appointmentRepository.save(appointment);
    
    this.logger.log(`Appointment cancelled successfully - ID: ${cancelled.id}, Doctor: ${cancelled.doctorId}, Date: ${cancelled.appointmentDate}, Slot: ${cancelled.slotNumber}`);
    
    return {
      message: 'Appointment cancelled successfully',
      appointment: cancelled,
    };
  }

  async rescheduleAppointment(dto: any) {
    this.logger.log(`Attempting to reschedule appointment - ID: ${dto.appointmentId}, Phone: ${dto.patientPhone}, Old Date: ${dto.oldAppointmentDate}, New Date: ${dto.newAppointmentDate}, New Slot: ${dto.newSlotNumber}`);
    
    let appointment: Appointment | null = null;

    // Find existing appointment
    if (dto.appointmentId) {
      this.logger.debug(`Finding appointment by ID: ${dto.appointmentId}`);
      appointment = await this.appointmentRepository.findOne({
        where: { id: dto.appointmentId },
      });
      
      if (!appointment) {
        this.logger.warn(`Reschedule failed - Appointment not found with ID: ${dto.appointmentId}`);
        throw new BadRequestException('Appointment not found');
      }
    }
    else if (dto.patientPhone && dto.oldAppointmentDate) {
      this.logger.debug(`Finding appointment by phone: ${dto.patientPhone} and date: ${dto.oldAppointmentDate}`);
      appointment = await this.appointmentRepository.findOne({
        where: {
          patientPhone: dto.patientPhone,
          appointmentDate: dto.oldAppointmentDate,
          status: AppointmentStatus.BOOKED,
        },
      });
      
      if (!appointment) {
        this.logger.warn(`Reschedule failed - No booked appointment found for phone: ${dto.patientPhone} on date: ${dto.oldAppointmentDate}`);
        throw new BadRequestException('No active appointment found for this phone number on the given date');
      }
    }
    else {
      this.logger.warn(`Reschedule failed - Invalid request parameters`);
      throw new BadRequestException('Please provide either appointmentId or both patientPhone and oldAppointmentDate');
    }

    // Check if already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      this.logger.warn(`Reschedule failed - Appointment already cancelled - ID: ${appointment.id}`);
      throw new BadRequestException('This appointment has already been cancelled and cannot be rescheduled');
    }

    // Store old appointment details
    const oldAppointmentDetails = { ...appointment };

    // Validate new date is not Sunday
    const newDate = new Date(dto.newAppointmentDate);
    if (newDate.getDay() === 0) {
      this.logger.warn(`Reschedule failed - New date is Sunday: ${dto.newAppointmentDate}`);
      throw new BadRequestException('Appointments are not available on Sundays');
    }

    // Fetch doctor
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: appointment.doctorId },
    });
    if (!doctor) {
      this.logger.warn(`Reschedule failed - Doctor not found: ${appointment.doctorId}`);
      throw new BadRequestException('Doctor not found');
    }

    // Calculate total slots and validate new slot number
    const totalSlots = Math.floor(
      (this.toMinutes(doctor.end_time) - this.toMinutes(doctor.start_time)) /
      doctor.slot_duration
    );

    if (dto.newSlotNumber < 1 || dto.newSlotNumber > totalSlots) {
      this.logger.warn(`Reschedule failed - Invalid new slot number: ${dto.newSlotNumber} (valid: 1-${totalSlots})`);
      throw new BadRequestException(`Invalid slot number. Valid slots are 1 to ${totalSlots}`);
    }

    // Check if new slot is already booked (excluding the current appointment)
    const existingSlot = await this.appointmentRepository.findOne({
      where: {
        doctorId: appointment.doctorId,
        appointmentDate: dto.newAppointmentDate,
        slotNumber: dto.newSlotNumber,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingSlot && existingSlot.id !== appointment.id) {
      this.logger.warn(`Reschedule failed - New slot ${dto.newSlotNumber} already booked on ${dto.newAppointmentDate}`);
      throw new BadRequestException('The requested time slot is already booked. Please choose another slot.');
    }

    // Cancel old appointment
    this.logger.debug(`Cancelling old appointment ID: ${appointment.id}`);
    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepository.save(appointment);

    // Calculate reporting time for new slot
    const startMinutes = this.toMinutes(doctor.start_time);
    const reportingMinutes = startMinutes + (dto.newSlotNumber - 1) * doctor.slot_duration;
    const hours = Math.floor(reportingMinutes / 60).toString().padStart(2, '0');
    const mins = (reportingMinutes % 60).toString().padStart(2, '0');
    const reportingTime = `${hours}:${mins}`;

    // Create new appointment
    this.logger.debug(`Creating new appointment with rescheduled details`);
    const newAppointment = this.appointmentRepository.create({
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      appointmentDate: dto.newAppointmentDate,
      slotNumber: dto.newSlotNumber,
      status: AppointmentStatus.BOOKED,
      patientPhone: appointment.patientPhone,
      patientName: appointment.patientName,
      reasonForVisit: appointment.reasonForVisit,
    });

    const saved = await this.appointmentRepository.save(newAppointment);

    this.logger.log(`Appointment rescheduled successfully - Old ID: ${oldAppointmentDetails.id}, New ID: ${saved.id}, Old Date: ${oldAppointmentDetails.appointmentDate}, New Date: ${dto.newAppointmentDate}, New Slot: ${dto.newSlotNumber}, New Time: ${reportingTime}`);

    return {
      message: 'Appointment rescheduled successfully',
      cancelledAppointment: oldAppointmentDetails,
      newAppointment: saved,
      newReportingTime: reportingTime,
    };
  }
}

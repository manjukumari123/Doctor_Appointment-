import { Controller, Post, Body, Logger, Get, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { GetAvailabilityDto } from './dto/get-availability.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('appointments')
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async bookAppointment(@Body() dto: CreateAppointmentDto) {
    this.logger.log(`Received appointment booking request - Doctor ID: ${dto.doctorId}, Patient ID: ${dto.patientId}, Date: ${dto.date}`);
    this.logger.debug(`Appointment booking request details:`, dto);
    return this.appointmentsService.bookAppointment(dto);
  }

  @Get('availability')
  async getAvailability(@Query() query: GetAvailabilityDto) {
    this.logger.log(`Received availability check request - Doctor ID: ${query.doctorId}, Date: ${query.date || 'today'}`);
    return this.appointmentsService.getAvailability(query.doctorId, query.date);
  }

  @Post('book')
  async bookAppointmentWithSlot(@Body() dto: BookAppointmentDto) {
    this.logger.log(`Received appointment booking with slot request - Doctor ID: ${dto.doctorId}, Phone: ${dto.patientPhone}, Date: ${dto.appointmentDate}, Slot: ${dto.slotNumber}`);
    this.logger.debug(`Appointment booking request details:`, dto);
    return this.appointmentsService.bookAppointmentWithSlot(dto);
  }

  @Get('next-available')
  async getNextAvailableDay(@Query('doctorId') doctorId: string) {
    this.logger.log(`Received next available day request - Doctor ID: ${doctorId}`);
    return this.appointmentsService.getNextAvailableDay(+doctorId);
  }

  @Post('cancel')
  async cancelAppointment(@Body() dto: CancelAppointmentDto) {
    this.logger.log(`Received appointment cancellation request - ID: ${dto.appointmentId}, Phone: ${dto.patientPhone}, Date: ${dto.appointmentDate}`);
    this.logger.debug(`Cancellation request details:`, dto);
    return this.appointmentsService.cancelAppointment(dto);
  }

  @Post('reschedule')
  async rescheduleAppointment(@Body() dto: RescheduleAppointmentDto) {
    this.logger.log(`Received appointment reschedule request - ID: ${dto.appointmentId}, Phone: ${dto.patientPhone}, Old Date: ${dto.oldAppointmentDate}, New Date: ${dto.newAppointmentDate}, New Slot: ${dto.newSlotNumber}`);
    this.logger.debug(`Reschedule request details:`, dto);
    return this.appointmentsService.rescheduleAppointment(dto);
  }
}

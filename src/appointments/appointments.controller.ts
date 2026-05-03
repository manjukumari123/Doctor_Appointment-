import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
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
}

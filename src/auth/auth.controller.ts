import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDoctorDto } from './dto/signup-doctor.dto';
import { SignupPatientDto } from './dto/signup-patient.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('signup/doctor')
  signupDoctor(@Body() dto: SignupDoctorDto) {
    this.logger.log(`Received doctor signup request for: ${dto.email}`);
    return this.authService.signupDoctor(dto);
  }

  @Post('signup/patient')
  signupPatient(@Body() dto: SignupPatientDto) {
    this.logger.log(`Received patient signup request for: ${dto.email}`);
    return this.authService.signupPatient(dto);
  }

  @Post('login/doctor')
  loginDoctor(@Body() dto: LoginDto) {
    this.logger.log(`Received doctor login request for: ${dto.email}`);
    return this.authService.loginDoctor(dto);
  }

  @Post('login/patient')
  loginPatient(@Body() dto: LoginDto) {
    this.logger.log(`Received patient login request for: ${dto.email}`);
    return this.authService.loginPatient(dto);
  }
}

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Doctor } from '../doctors/doctor.entity';
import { Patient } from '../patients/patient.entity';
import { SignupDoctorDto } from './dto/signup-doctor.dto';
import { SignupPatientDto } from './dto/signup-patient.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private jwtService: JwtService,
  ) {}

  async signupDoctor(dto: SignupDoctorDto) {
    this.logger.log(`[Auth] Attempting doctor signup with email: ${dto.email}`);
    const exists = await this.doctorRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`[Auth] Doctor email already registered: ${dto.email}`);
      throw new ConflictException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const doctor = this.doctorRepository.create({ ...dto, password: hashed });
    await this.doctorRepository.save(doctor);
    this.logger.log(`[Auth] Doctor registered successfully with ID: ${doctor.doctor_id}`);
    return { message: 'Doctor registered successfully' };
  }

  async signupPatient(dto: SignupPatientDto) {
    this.logger.log(`[Auth] Attempting patient signup with email: ${dto.email}`);
    const exists = await this.patientRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`[Auth] Patient email already registered: ${dto.email}`);
      throw new ConflictException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const patient = this.patientRepository.create({ ...dto, password: hashed });
    await this.patientRepository.save(patient);
    this.logger.log(`[Auth] Patient registered successfully with ID: ${patient.patient_id}`);
    return { message: 'Patient registered successfully' };
  }

  async loginDoctor(dto: LoginDto) {
    this.logger.log(`[Auth] Attempting doctor login with email: ${dto.email}`);
    const doctor = await this.doctorRepository.findOne({
      where: { email: dto.email },
    });
    if (!doctor) {
      this.logger.warn(`[Auth] Doctor not found with email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, doctor.password);
    if (!match) {
      this.logger.warn(`[Auth] Invalid password for doctor: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: doctor.doctor_id,
      email: doctor.email,
      role: 'doctor',
    });
    this.logger.log(`[Auth] Doctor login successful for email: ${dto.email}`);
    return { access_token: token };
  }

  async loginPatient(dto: LoginDto) {
    this.logger.log(`[Auth] Attempting patient login with email: ${dto.email}`);
    const patient = await this.patientRepository.findOne({
      where: { email: dto.email },
    });
    if (!patient) {
      this.logger.warn(`[Auth] Patient not found with email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, patient.password);
    if (!match) {
      this.logger.warn(`[Auth] Invalid password for patient: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: patient.patient_id,
      email: patient.email,
      role: 'patient',
    });
    this.logger.log(`[Auth] Patient login successful for email: ${dto.email}`);
    return { access_token: token };
  }
}

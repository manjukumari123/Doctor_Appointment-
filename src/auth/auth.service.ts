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
    this.logger.log(`Attempting doctor signup for email: ${dto.email}`);
    
    const exists = await this.doctorRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`Doctor signup failed - email already exists: ${dto.email}`);
      throw new ConflictException('Email already registered');
    }

    this.logger.debug(`Hashing password for doctor signup: ${dto.email}`);
    const hashed = await bcrypt.hash(dto.password, 10);
    
    this.logger.debug(`Creating doctor entity for: ${dto.email}`);
    const doctor = this.doctorRepository.create({ ...dto, password: hashed });
    
    this.logger.debug(`Saving doctor to database: ${dto.email}`);
    await this.doctorRepository.save(doctor);
    
    this.logger.log(`Doctor signup successful: ${dto.email}`);
    return { message: 'Doctor registered successfully' };
  }

  async signupPatient(dto: SignupPatientDto) {
    this.logger.log(`Attempting patient signup for email: ${dto.email}`);
    
    const exists = await this.patientRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`Patient signup failed - email already exists: ${dto.email}`);
      throw new ConflictException('Email already registered');
    }

    this.logger.debug(`Hashing password for patient signup: ${dto.email}`);
    const hashed = await bcrypt.hash(dto.password, 10);
    
    this.logger.debug(`Creating patient entity for: ${dto.email}`);
    const patient = this.patientRepository.create({ ...dto, password: hashed });
    
    this.logger.debug(`Saving patient to database: ${dto.email}`);
    await this.patientRepository.save(patient);
    
    this.logger.log(`Patient signup successful: ${dto.email}`);
    return { message: 'Patient registered successfully' };
  }

  async loginDoctor(dto: LoginDto) {
    this.logger.log(`Attempting doctor login for email: ${dto.email}`);
    
    this.logger.debug(`Looking up doctor in database: ${dto.email}`);
    const doctor = await this.doctorRepository.findOne({
      where: { email: dto.email },
    });
    if (!doctor) {
      this.logger.warn(`Doctor login failed - user not found: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`Comparing password for doctor: ${dto.email}`);
    const match = await bcrypt.compare(dto.password, doctor.password);
    if (!match) {
      this.logger.warn(`Doctor login failed - invalid password: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`Generating JWT token for doctor: ${dto.email} (ID: ${doctor.doctor_id})`);
    const token = this.jwtService.sign({
      sub: doctor.doctor_id,
      email: doctor.email,
      role: 'doctor',
    });
    
    this.logger.log(`Doctor login successful: ${dto.email}`);
    return { access_token: token };
  }

  async loginPatient(dto: LoginDto) {
    this.logger.log(`Attempting patient login for email: ${dto.email}`);
    
    this.logger.debug(`Looking up patient in database: ${dto.email}`);
    const patient = await this.patientRepository.findOne({
      where: { email: dto.email },
    });
    if (!patient) {
      this.logger.warn(`Patient login failed - user not found: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`Comparing password for patient: ${dto.email}`);
    const match = await bcrypt.compare(dto.password, patient.password);
    if (!match) {
      this.logger.warn(`Patient login failed - invalid password: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`Generating JWT token for patient: ${dto.email} (ID: ${patient.patient_id})`);
    const token = this.jwtService.sign({
      sub: patient.patient_id,
      email: patient.email,
      role: 'patient',
    });
    
    this.logger.log(`Patient login successful: ${dto.email}`);
    return { access_token: token };
  }
}

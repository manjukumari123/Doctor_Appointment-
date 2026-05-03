import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async findAll() {
    return this.patientRepository.find({
      select: ['patient_id', 'first_name', 'last_name', 'problem', 'email']
    });
  }

  async findOne(id: number) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: id },
      select: ['patient_id', 'first_name', 'last_name', 'problem', 'email']
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: number, updateData: Partial<Patient>) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: id }
    });
    if (!patient) throw new NotFoundException('Patient not found');
    
    Object.assign(patient, updateData);
    return this.patientRepository.save(patient);
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

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
    this.logger.log(`Attempting to update patient profile with ID: ${id}`);
    this.logger.debug(`Update data for patient ${id}:`, updateData);
    
    this.logger.debug(`Looking up patient with ID: ${id}`);
    const patient = await this.patientRepository.findOne({
      where: { patient_id: id }
    });
    if (!patient) {
      this.logger.warn(`Patient update failed - patient not found with ID: ${id}`);
      throw new NotFoundException('Patient not found');
    }
    
    this.logger.debug(`Assigning update data to patient ${id}`);
    Object.assign(patient, updateData);
    
    this.logger.debug(`Saving updated patient ${id} to database`);
    const updatedPatient = await this.patientRepository.save(patient);
    
    this.logger.log(`Patient profile updated successfully for ID: ${id}`);
    return updatedPatient;
  }
}

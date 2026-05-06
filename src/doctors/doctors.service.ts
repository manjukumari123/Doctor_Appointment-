import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from './doctor.entity';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

  async findAll() {
    return this.doctorRepository.find({
      select: ['doctor_id', 'first_name', 'last_name', 'specialty', 'email', 'start_time', 'end_time', 'slot_duration']
    });
  }

  async findOne(id: number) {
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: id },
      select: ['doctor_id', 'first_name', 'last_name', 'specialty', 'email', 'start_time', 'end_time', 'slot_duration']
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async update(id: number, updateData: Partial<Doctor>) {
    this.logger.log(`Attempting to update doctor profile with ID: ${id}`);
    this.logger.debug(`Update data for doctor ${id}:`, updateData);
    
    this.logger.debug(`Looking up doctor with ID: ${id}`);
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: id }
    });
    if (!doctor) {
      this.logger.warn(`Doctor update failed - doctor not found with ID: ${id}`);
      throw new NotFoundException('Doctor not found');
    }
    
    this.logger.debug(`Assigning update data to doctor ${id}`);
    Object.assign(doctor, updateData);
    
    this.logger.debug(`Saving updated doctor ${id} to database`);
    const updatedDoctor = await this.doctorRepository.save(doctor);
    
    this.logger.log(`Doctor profile updated successfully for ID: ${id}`);
    return updatedDoctor;
  }
}

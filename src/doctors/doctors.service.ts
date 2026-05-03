import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from './doctor.entity';

@Injectable()
export class DoctorsService {
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
    const doctor = await this.doctorRepository.findOne({
      where: { doctor_id: id }
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    
    Object.assign(doctor, updateData);
    return this.doctorRepository.save(doctor);
  }
}

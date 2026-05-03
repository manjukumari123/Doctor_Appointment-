import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  async findAll() {
    return this.doctorsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(+id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateDoctorDto) {
    return this.doctorsService.update(+id, updateData);
  }
}

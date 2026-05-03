import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  async findAll() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.patientsService.findOne(+id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdatePatientDto) {
    return this.patientsService.update(+id, updateData);
  }
}

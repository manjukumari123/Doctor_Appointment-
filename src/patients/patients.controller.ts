import { Controller, Get, Put, Param, Body, Logger } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patients')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);

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
    this.logger.log(`Received patient profile update request for ID: ${id}`);
    this.logger.debug(`Update data received for patient ${id}:`, updateData);
    return this.patientsService.update(+id, updateData);
  }
}

import { Controller, Get, Put, Param, Body, Logger, Query } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Controller('doctors')
export class DoctorsController {
  private readonly logger = new Logger(DoctorsController.name);

  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  async findAll() {
    return this.doctorsService.findAll();
  }

  @Get('search')
  async search(@Query('q') query: string) {
    this.logger.log(`Received doctor search request with query: ${query}`);
    return this.doctorsService.search(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(+id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateDoctorDto) {
    this.logger.log(`Received doctor profile update request for ID: ${id}`);
    this.logger.debug(`Update data received for doctor ${id}:`, updateData);
    return this.doctorsService.update(+id, updateData);
  }
}

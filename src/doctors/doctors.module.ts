import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './doctor.entity';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor])],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [TypeOrmModule, DoctorsService],
})
export class DoctorsModule {}

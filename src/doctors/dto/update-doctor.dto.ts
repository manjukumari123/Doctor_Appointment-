import { IsString, IsEmail, IsNumber, Min, IsOptional } from 'class-validator';

export class UpdateDoctorDto {
  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  start_time?: string;

  @IsString()
  @IsOptional()
  end_time?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  slot_duration?: number;
}

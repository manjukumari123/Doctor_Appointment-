import { IsString, IsEmail, IsNumber, Min } from 'class-validator';

export class SignupDoctorDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  specialty: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  start_time: string;

  @IsString()
  end_time: string;

  @IsNumber()
  @Min(1)
  slot_duration: number;
}

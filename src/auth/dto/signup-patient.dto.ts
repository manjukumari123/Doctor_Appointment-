import { IsString, IsEmail } from 'class-validator';

export class SignupPatientDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  problem: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

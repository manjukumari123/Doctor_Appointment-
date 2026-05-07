import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';

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

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobile_number?: string;
}

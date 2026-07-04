import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { GivingType, PaymentMethod } from '@prisma/client';

export class RecordGivingDto {
  @IsOptional()
  @IsUUID('4', { message: 'Member ID must be a valid UUID.' })
  memberId?: string;

  @IsNotEmpty()
  @IsNumberString({}, { message: 'Amount must be a valid numeric string value to preserve decimal precision.' })
  amount!: string;

  @IsNotEmpty()
  @IsEnum(GivingType, { message: 'Invalid giving classification category.' })
  type!: GivingType;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reference?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Invalid financial payment method selected.' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}
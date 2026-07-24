import { PartialType } from '@nestjs/mapped-types'; // Or '@nestjs/swagger'
import { RecordGivingDto } from './record-giving.dto';

export class UpdateGivingDto extends PartialType(RecordGivingDto) {}
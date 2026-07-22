import { IsArray, IsUUID, ArrayNotEmpty, IsOptional } from 'class-validator';

export class BulkContactActionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one contact ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each ID must be a valid UUID' })
  ids!: string[];

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
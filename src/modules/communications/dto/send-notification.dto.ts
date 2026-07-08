import { IsArray, IsOptional, IsString, IsNotEmpty, ArrayUnique } from 'class-validator';

export class SendNotificationDto {
  @IsOptional()
  @IsArray({ message: 'Channels must be provided as an array of strings.' })
  @ArrayUnique({ message: 'Channels array cannot contain duplicate communication methods.' })
  @IsString({ each: true, message: 'Each communication channel must be a valid text string.' })
  @IsNotEmpty({ each: true, message: 'A communication channel name cannot be an empty string.' })
  channels?: string[];
}
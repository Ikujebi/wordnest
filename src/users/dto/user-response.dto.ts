import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client'; 

@Exclude()
export class UserMemberResponseDto {
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  @Expose()
  id!: string; // Added '!' here

  @ApiProperty({ example: 'Jane' })
  @Expose()
  firstName!: string; // Added '!' here

  @ApiProperty({ example: 'Doe' })
  @Expose()
  lastName!: string; // Added '!' here

  @ApiPropertyOptional({ example: 'Alex', nullable: true })
  @Expose()
  otherName!: string | null;

  @ApiPropertyOptional({ example: 'MALE', enum: ['MALE', 'FEMALE'], nullable: true })
  @Expose()
  gender!: string | null;

  @ApiPropertyOptional({ example: '1995-04-15T00:00:00.000Z', nullable: true })
  @Expose()
  dateOfBirth!: Date | null;
}

@Exclude()
export class UserResponseDto {
  @ApiProperty({ 
    description: 'Unique identifier of the user (UUID v4)', 
    example: '8c2aeb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' 
  })
  @Expose()
  id!: string;

  @ApiProperty({ description: 'The primary email address of the user', example: 'jane.doe@example.com' })
  @Expose()
  email!: string;

  @ApiProperty({ description: 'The system-wide display name', example: 'Jane Doe' })
  @Expose()
  fullName!: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+1234567890', nullable: true })
  @Expose()
  phoneNumber!: string | null;

  @ApiProperty({ description: 'The authorization role within the system', enum: Role, example: Role.MEMBER })
  @Expose()
  role!: Role;

  @ApiProperty({ description: 'Indicates if the user account is active', example: true })
  @Expose()
  isActive!: boolean;

  @ApiProperty({ description: 'Indicates if the user email has been verified', example: false })
  @Expose()
  emailVerified!: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when email was verified', example: '2026-07-04T02:27:00.000Z', nullable: true })
  @Expose()
  emailVerifiedAt!: Date | null;

  @ApiPropertyOptional({ description: 'Timestamp of the last successful login', example: '2026-07-04T01:15:22.000Z', nullable: true })
  @Expose()
  lastLoginAt!: Date | null;

  @ApiProperty({ description: 'Timestamp when the user account was created', example: '2026-06-01T10:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ description: 'Timestamp of the last update to the user profile', example: '2026-07-04T02:00:00.000Z' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Linked physical member profile information', type: UserMemberResponseDto, nullable: true })
  @Expose()
  @Type(() => UserMemberResponseDto)
  member!: UserMemberResponseDto | null;
}
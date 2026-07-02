import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({
    message: 'Refresh token is required.',
  })
  @IsString({
    message: 'Refresh token must be a string.',
  })
  @MaxLength(2048, {
    message: 'Refresh token is too long.',
  })
  refreshToken!: string;
}
import { IsBoolean } from 'class-validator';

export class ToggleAdminStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
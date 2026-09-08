// dto/finalize-cohort.dto.ts
import { IsArray, ValidateNested, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class GraduationResult {
  @IsString()
  memberId!: string;

  @IsBoolean()
  graduated!: boolean;
}

export class FinalizeCohortDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraduationResult)
  results!: GraduationResult[];
}
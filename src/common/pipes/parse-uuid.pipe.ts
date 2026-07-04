import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(
    value: string,
    metadata: ArgumentMetadata,
  ): string {
    if (!value) {
      throw new BadRequestException(
        `${metadata.data ?? 'Value'} is required.`,
      );
    }

    const trimmedValue = value.trim();

    if (!isUuid(trimmedValue)) {
      throw new BadRequestException(
        `${metadata.data ?? 'Value'} must be a valid UUID.`,
      );
    }

    return trimmedValue;
  }
}
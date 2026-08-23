import { IsString, IsNotEmpty } from 'class-validator';

/**
 * A single new remark to append to the pipeline record's notes log — the
 * server does the timestamped concatenation, not the client, so concurrent
 * note-adds from different admins can't clobber each other's text.
 */
export class AddPipelineNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

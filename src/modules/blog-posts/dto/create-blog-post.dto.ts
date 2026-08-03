import { IsString, IsNotEmpty, IsOptional, IsUrl, IsBoolean } from 'class-validator';

export class CreateBlogPostDto {
  @IsString() @IsNotEmpty()
  title!: string;

  @IsString() @IsNotEmpty()
  content!: string;

  @IsOptional() @IsString()
  excerpt?: string;

  @IsOptional() @IsUrl()
  coverImage?: string;

  @IsOptional() @IsBoolean()
  isPublished?: boolean;
}
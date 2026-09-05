import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
  Req,
  UnauthorizedException,
  Inject,       // 👈 Add this
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { UnverifiedUsersQueryDto } from './dto/unverified-users-query.dto';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPaginationQueryDto } from './dto/user-pagination-query.dto';
import { USER_ERROR_MESSAGES } from './users.constants';

// Auth Guard & Role Imports
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/interfaces/auth-request.interface';
import { AuthService } from '../auth/auth.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new system user and physical profile link',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: UserResponseDto,
    description: 'User successfully created.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: USER_ERROR_MESSAGES.EMAIL_ALREADY_EXISTS,
  })
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const rawUser = await this.usersService.create(createUserDto);
    return plainToInstance(UserResponseDto, rawUser);
  }

  @Get()
  @ApiOperation({
    summary: 'Retrieve a paginated list of active users',
  })
  @ApiOkResponse({
    type: UserResponseDto,
    isArray: true,
  })
  async findAll(
    @Query() query: UserPaginationQueryDto,
  ): Promise<UserResponseDto[]> {
    const rawUsers = await this.usersService.findAll(query);
    return plainToInstance(UserResponseDto, rawUsers);
  }

  /**
   * Keep static sub-routes ABOVE parameterized ':id' routes so NestJS doesn't evaluate 'birthdays' or 'unverified' as an ID.
   */
  @Get('birthdays')
  @ApiOperation({ summary: 'Get members with birthdays in the next N days' })
  async getUpcomingBirthdays(@Query('days') days?: string) {
    return this.usersService.getUpcomingBirthdays(
      days ? Number(days) : undefined,
    );
  }
  @Get('birthdays/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Full birthday directory, filterable by month and searchable by name' })
  async getAllBirthdays(
    @Query('month') month?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.getAllBirthdays({
      month: month ? Number(month) : undefined,
      search,
    });
  }
  @Get('unverified')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'List registered users who have not yet verified their email',
  })
  async listUnverified(@Query() query: UnverifiedUsersQueryDto) {
    return this.usersService.listUnverifiedByRole(query.roles);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed user account by ID',
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: USER_ERROR_MESSAGES.NOT_FOUND,
  })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserResponseDto> {
    const rawUser = await this.usersService.findOne(id);
    return plainToInstance(UserResponseDto, rawUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update partial fields of a user profile',
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: USER_ERROR_MESSAGES.NOT_FOUND,
  })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const rawUser = await this.usersService.update(id, updateUserDto);
    return plainToInstance(UserResponseDto, rawUser);
  }

  /**
   * Upload / Replace Profile Picture
   */
  @Patch(':id/profile-picture')
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload or replace a user profile picture',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profilePicture: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  async updateProfilePicture(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp)$/i,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const rawUser = await this.usersService.updateProfilePicture(id, file);

    return plainToInstance(UserResponseDto, rawUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete a user account',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User has been successfully deactivated.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: USER_ERROR_MESSAGES.NOT_FOUND,
  })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.usersService.softDelete(id);
  }

  @Post(':id/resend-verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary:
      "Admin-triggered resend of an unverified account's verification email",
  })
  async resendVerification(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId)
      throw new UnauthorizedException('Admin identification failed.');

    return this.authService.resendVerificationEmail(id);
  }

  @Delete(':id/unverified')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary:
      'Permanently delete an account that never completed email verification',
  })
  async deleteUnverified(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const performingAdminId = req.user?.id;
    if (!performingAdminId)
      throw new UnauthorizedException('Admin identification failed.');

    return this.usersService.deleteUnverifiedUser(id, performingAdminId);
  }
}
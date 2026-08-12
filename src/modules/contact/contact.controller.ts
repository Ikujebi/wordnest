import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactQueryDto } from './dto/contact-query.dto';
import { BulkContactActionDto } from './dto/bulk-contact-action.dto';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: Role;
    [key: string]: any;
  };
}

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * Public contact form submission — unauthenticated, so this is the one
   * route on this controller that genuinely needs abuse protection.
   * POST /contact
   */
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateContactDto) {
    return {
      message: 'Your message has been submitted successfully',
      data: await this.contactService.create(dto),
    };
  }

  // =========================================================================
  // ADMIN ROUTES - STATIC PATHS (MUST BE DEFINED BEFORE PARAMETERIZED :id)
  // Everything below is already behind JwtAuthGuard + RolesGuard, so it's
  // skipped from throttling entirely — dashboards/tables can safely fire
  // several of these per page load without tripping a limit.
  // =========================================================================

  @Get()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(@Query() query: ContactQueryDto) {
    return this.contactService.findAll(query);
  }

  @Get('statistics')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async statistics() {
    return this.contactService.statistics();
  }

  @Get('latest')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async latest(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.contactService.latest(limit);
  }

  @Patch('bulk/resolve')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async bulkResolve(
    @Body() dto: BulkContactActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Contacts resolved successfully',
      data: await this.contactService.bulkResolve(dto.ids, req.user.id),
    };
  }

  @Delete('bulk')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async bulkDelete(@Body() dto: BulkContactActionDto) {
    return {
      message: 'Contacts deleted successfully',
      data: await this.contactService.bulkDelete(dto.ids),
    };
  }

  @Patch('bulk/restore')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async bulkRestore(@Body() dto: BulkContactActionDto) {
    return {
      message: 'Contacts restored successfully',
      data: await this.contactService.bulkRestore(dto.ids),
    };
  }

  // =========================================================================
  // ADMIN ROUTES - PARAMETERIZED PATHS (:id)
  // =========================================================================

  @Get(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.findOne(id);
  }

  @Patch(':id/read')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact marked as read',
      data: await this.contactService.markAsRead(id),
    };
  }

  @Patch(':id/resolve')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      message: 'Contact resolved successfully',
      data: await this.contactService.resolve(id, req.user.id),
    };
  }

  @Patch(':id/unresolve')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async unresolve(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact reopened',
      data: await this.contactService.unresolve(id),
    };
  }

  @Patch(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return {
      message: 'Contact updated',
      data: await this.contactService.update(id, dto),
    };
  }

  @Delete(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact deleted',
      data: await this.contactService.remove(id),
    };
  }

  @Patch(':id/restore')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact restored successfully',
      data: await this.contactService.restore(id),
    };
  }

  /**
   * Super Admin Only: Permanently delete message from DB
   */
  @Delete(':id/permanent')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async deletePermanent(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact permanently purged',
      data: await this.contactService.deletePermanent(id),
    };
  }
}
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
   * Public contact form submission
   * POST /contact
   * Website: wordtabernacle.org.ng/contact
   */
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
  // =========================================================================

  /**
   * Admin: Fetch all contact messages with filters & pagination
   * GET /contact
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(@Query() query: ContactQueryDto) {
    return this.contactService.findAll(query);
  }

  /**
   * Admin: Get dashboard aggregated statistics
   * GET /contact/statistics
   */
  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async statistics() {
    return this.contactService.statistics();
  }

  /**
   * Admin: Fetch latest messages for dashboard widgets
   * GET /contact/latest?limit=5
   */
  @Get('latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async latest(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.contactService.latest(limit);
  }

  /**
   * Admin: Bulk resolve contact messages
   * PATCH /contact/bulk/resolve
   */
  @Patch('bulk/resolve')
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

  /**
   * Admin: Bulk soft delete contact messages
   * DELETE /contact/bulk
   */
  @Delete('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async bulkDelete(@Body() dto: BulkContactActionDto) {
    return {
      message: 'Contacts deleted successfully',
      data: await this.contactService.bulkDelete(dto.ids),
    };
  }

  /**
   * Admin: Bulk restore soft-deleted contact messages
   * PATCH /contact/bulk/restore
   */
  @Patch('bulk/restore')
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

  /**
   * Admin: Get single contact message details
   * GET /contact/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactService.findOne(id);
  }

  /**
   * Admin: Mark contact as read
   * PATCH /contact/:id/read
   */
  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact marked as read',
      data: await this.contactService.markAsRead(id),
    };
  }

  /**
   * Admin: Resolve contact (assigns handler to logged-in admin)
   * PATCH /contact/:id/resolve
   */
  @Patch(':id/resolve')
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

  /**
   * Admin: Reopen/unresolve contact
   * PATCH /contact/:id/unresolve
   */
  @Patch(':id/unresolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async unresolve(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact reopened',
      data: await this.contactService.unresolve(id),
    };
  }

  /**
   * Admin: Update contact fields
   * PATCH /contact/:id
   */
  @Patch(':id')
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

  /**
   * Admin: Soft delete contact message
   * DELETE /contact/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact deleted',
      data: await this.contactService.remove(id),
    };
  }

  /**
   * Admin: Restore soft-deleted message
   * PATCH /contact/:id/restore
   */
  @Patch(':id/restore')
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
   * DELETE /contact/:id/permanent
   */
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async deletePermanent(@Param('id', ParseUUIDPipe) id: string) {
    return {
      message: 'Contact permanently purged',
      data: await this.contactService.deletePermanent(id),
    };
  }
}
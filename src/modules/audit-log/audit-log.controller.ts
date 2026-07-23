import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { AuditLogService } from './audit-log.service';

import { QueryAuditDto } from './dto/audit-query.dto';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * GET /audit-logs
   */
  @Get()
  findAll(
    @Query() query: QueryAuditDto,

    @Query(
      'page',
      new DefaultValuePipe(1),
      ParseIntPipe,
    )
    page: number,

    @Query(
      'limit',
      new DefaultValuePipe(20),
      ParseIntPipe,
    )
    limit: number,
  ) {
    return this.auditLogService.findAll(
      query,
      page,
      limit,
    );
  }

  /**
   * GET /audit-logs/:id
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.auditLogService.findOne(id);
  }

  /**
   * GET /audit-logs/user/:userId
   */
  @Get('user/:userId')
  findUserHistory(
    @Param('userId') userId: string,
  ) {
    return this.auditLogService.findUserHistory(
      userId,
    );
  }

  /**
   * GET /audit-logs/entity/:entity/:entityId
   */
  @Get('entity/:entity/:entityId')
  findEntityHistory(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findEntityHistory(
      entity,
      entityId,
    );
  }
}
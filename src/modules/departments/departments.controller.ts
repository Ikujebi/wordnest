// src/departments/departments.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import { AssignDepartmentLeaderDto } from './dto/assign-department-leader.dto';
import { CreateDepartmentMetricDto } from './dto/create-department-metric.dto';
import { RecordMetricEntryDto } from './dto/record-metric-entry.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async createDepartment(
    @Req() req: any,
    @Body() createDepartmentDto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(createDepartmentDto, req.user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getDepartments() {
    return this.departmentsService.findAll();
  }

  @Get('performance')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getDepartmentPerformance(@Query('period') period?: string) {
    return this.departmentsService.getPerformance(period);
  }

  /**
   * Assigns an active department member as the department leader.
   */
  @Patch(':id/leader')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async assignDepartmentLeader(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Req() req: any,
    @Body() dto: AssignDepartmentLeaderDto,
  ) {
    return this.departmentsService.assignLeader(
      departmentId,
      dto,
      req.user.id,
    );
  }

  /**
   * Lists active roster members of a department (e.g. for leader assignment dropdowns).
   */
  @Get(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getDepartmentMembers(
    @Param('id', ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentsService.getDepartmentMembers(departmentId);
  }

  @Post(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async addMemberToRoster(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Req() req: any,
    @Body() dto: AddDepartmentMemberDto,
  ) {
    return this.departmentsService.addMember(
      departmentId,
      dto,
      req.user.id,
    );
  }

  @Patch(':departmentId/members/:memberId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async editRosterAssignment(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: any,
    @Body() dto: UpdateDepartmentMemberDto,
  ) {
    return this.departmentsService.updateMemberAssignment(
      departmentId,
      memberId,
      dto,
      req.user.id,
    );
  }
  @Delete(':departmentId/members/:memberId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async removeMemberFromRoster(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: any,
  ) {
    return this.departmentsService.removeMember(departmentId, memberId, req.user.id);
  }
  /**
   * Configures custom dynamic evaluation metrics and weight percentages (100% total).
   */
  @Put(':id/metrics')
  @Roles(Role.SUPER_ADMIN)
  async setDepartmentMetrics(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Req() req: any,
    @Body() metrics: CreateDepartmentMetricDto[],
  ) {
    return this.departmentsService.setDepartmentMetrics(
      departmentId,
      metrics,
      req.user.id,
    );
  }

  /**
   * Records or updates achieved metric entries for a specific evaluation period.
   */
  @Post(':id/metrics/entries')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async recordMetricEntries(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Req() req: any,
    @Body() entries: RecordMetricEntryDto[],
  ) {
    return this.departmentsService.recordMetricEntries(
      departmentId,
      entries,
      req.user.id,
    );
  }

  /**
   * Retrieves a single department by ID.
   * IMPORTANT: this must stay the LAST @Get route in the class — ':id' is a
   * catch-all pattern and would otherwise shadow 'performance' and ':id/members'.
   */
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findOne(id);
  }
  
}
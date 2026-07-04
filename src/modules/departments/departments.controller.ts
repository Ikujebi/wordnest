import { Controller, Get, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Adjust to match your path

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  async createDepartment(@Req() req: any, @Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto, req.user.id);
  }

  @Get()
  async getDepartments() {
    return this.departmentsService.findAll();
  }

  @Post(':id/members')
  async addMemberToRoster(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Req() req: any,
    @Body() dto: AddDepartmentMemberDto
  ) {
    return this.departmentsService.addMember(departmentId, dto, req.user.id);
  }

  @Patch(':departmentId/members/:memberId')
  async editRosterAssignment(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: any,
    @Body() dto: UpdateDepartmentMemberDto
  ) {
    return this.departmentsService.updateMemberAssignment(departmentId, memberId, dto, req.user.id);
  }
}
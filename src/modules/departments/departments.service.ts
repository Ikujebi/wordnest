import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Department, DepartmentMember, Prisma } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import slugify from 'slugify'; // Run `npm i slugify` or write a custom helper function

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new operational department alongside its unique search slug.
   */
  async create(dto: CreateDepartmentDto, creatorId: string): Promise<Department> {
    const slug = slugify(dto.name, { lower: true, strict: true });

    try {
      return await this.prisma.department.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          leaderId: dto.leaderId,
          createdById: creatorId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A department with this name or slug already exists.');
      }
      this.logger.error('Failed to create department', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An unexpected database error occurred.');
    }
  }

  /**
   * Lists all active departments.
   */
  async findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        leader: true,
        _count: { select: { members: true } },
      },
    });
  }

  /**
   * Adds a physical Member profile to a specific Department group.
   */
  async addMember(
    departmentId: string, 
    dto: AddDepartmentMemberDto, 
    creatorId: string
  ): Promise<DepartmentMember> {
    try {
      return await this.prisma.departmentMember.create({
        data: {
          departmentId,
          memberId: dto.memberId,
          role: dto.role,
          status: dto.status,
          createdById: creatorId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This member is already registered in this department.');
      }
      this.logger.error(`Failed to assign member to department ID: ${departmentId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('An unexpected error occurred assigning the member roster.');
    }
  }

  /**
   * Modifies role parameters or soft-removes a member from the operational team roster.
   */
  async updateMemberAssignment(
    departmentId: string,
    memberId: string,
    dto: UpdateDepartmentMemberDto,
    updaterId: string
  ): Promise<DepartmentMember> {
    const data: Prisma.DepartmentMemberUpdateInput = {
      ...dto,
      updatedById: updaterId,
      ...(dto.status === 'INACTIVE' ? { leftAt: new Date() } : {}),
      ...(dto.status === 'ACTIVE' ? { leftAt: null } : {}),
    };

    try {
      return await this.prisma.departmentMember.update({
        where: {
          memberId_departmentId: { memberId, departmentId },
          deletedAt: null,
        },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Active roster record for this member and department combination not found.');
      }
      this.logger.error(`Error updating roster assignment details for department: ${departmentId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Roster management update failed.');
    }
  }
}
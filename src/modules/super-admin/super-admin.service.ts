import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  //          GLOBAL DASHBOARD METHODS
  // ==========================================

  async getDashboardStats() {
  const now = new Date();

  const startOfCurrentMonth = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );


  const [
    totalMembers,
    activeWorkers,
    totalAdmins,
    totalDepartments,
    totalEvents,
    totalSermons,
    unreadMessages,
    pendingPrayerRequests,
    monthlyGivingSum,
  ] = await Promise.all([

    // Members
    this.prisma.member.count({
      where:{
        deletedAt:null,
      },
    }),


    // Workers
    this.prisma.member.count({
      where:{
        isWorker:true,
        deletedAt:null,
      },
    }),


    // Admins
    this.prisma.user.count({
      where:{
        role:{
          in:[
            Role.ADMIN,
            Role.SUPER_ADMIN,
          ],
        },
        deletedAt:null,
      },
    }),


    // Departments
    this.prisma.department.count({
      where:{
        deletedAt:null,
      },
    }),


    // Events
    this.prisma.event.count({
      where:{
        deletedAt:null,
      },
    }),


    // Sermons
    this.prisma.sermon.count({
      where:{
        deletedAt:null,
      },
    }),


    // Contact messages
    this.prisma.contactMessage.count({
      where:{
        isRead:false,
        deletedAt:null,
      },
    }),


    // Prayer requests
    this.prisma.prayerRequest.count({
      where:{
        status:"PENDING",
        deletedAt:null,
      },
    }),


    // Giving
    this.prisma.giving.aggregate({
      _sum:{
        amount:true,
      },
      where:{
        createdAt:{
          gte:startOfCurrentMonth,
        },
        deletedAt:null,
      },
    }),

  ]);


  return {

    members:{
      total:totalMembers,
    },


    workers:{
      active:activeWorkers,
    },


    admins:{
      total:totalAdmins,
    },


    departments:{
      total:totalDepartments,
    },


    events:{
      total:totalEvents,
    },


    sermons:{
      total:totalSermons,
    },


    messages:{
      unread:unreadMessages,
    },


    prayers:{
      pending:pendingPrayerRequests,
    },


    giving:{
      monthly:Number(
        monthlyGivingSum._sum.amount ?? 0
      ),
    },


    growthRate:0,

  };
}

  async getRecentProvisionings() {
    return this.prisma.auditLog.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true, 
        user: {
          select: {
            fullName: true 
          }
        }
      },
    });
  }

  // ==========================================
  //         INDIVIDUAL TARGETING METHODS
  // ==========================================

  async targetIndividualUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            maritalStatus: true,
            isWorker: true,
            occupation: true,
            address: true
          }
        }
      }
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(`User with ID ${userId} does not exist or has been removed.`);
    }

    return user;
  }

  async getIndividualsByRole(targetRole: Role) {
    return this.prisma.user.findMany({
      where: {
        role: targetRole,
        deletedAt: null 
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateIndividualStatus(userId: string, data: { role?: Role; isActive?: boolean }) {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists || userExists.deletedAt) {
      throw new NotFoundException('Target individual not found.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });
  }
}
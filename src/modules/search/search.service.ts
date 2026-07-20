import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async executeGlobalSearch(query: string) {
    const searchString = query.trim();

    // Run queries in parallel for fast command-palette execution
    const [members, events, sermons, departments, giving] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          OR: [
            { firstName: { contains: searchString, mode: 'insensitive' } },
            { lastName: { contains: searchString, mode: 'insensitive' } },
            { email: { contains: searchString, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      this.prisma.event.findMany({
        where: { title: { contains: searchString, mode: 'insensitive' } },
        take: 5,
      }),
      this.prisma.sermon.findMany({
        where: {
          OR: [
            { title: { contains: searchString, mode: 'insensitive' } },
            { speaker: { contains: searchString, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      this.prisma.department.findMany({
        where: { name: { contains: searchString, mode: 'insensitive' } },
        take: 5,
      }),
      this.prisma.giving.findMany({
        where: {
          OR: [
            { donorName: { contains: searchString, mode: 'insensitive' } },
            { reference: { contains: searchString, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
    ]);

    return {
      members,
      events,
      sermons,
      media: [], // Map or populate if needed
      departments,
      giving,
      admins: [],
      auditLogs: [],
    };
  }
}
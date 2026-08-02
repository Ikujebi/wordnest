import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GlobalSearchResults {
  members: Array<{ id: string; firstName: string; lastName: string; email: string | null; isWorker: boolean }>;
  events: Array<{ id: string; title: string; day: string; time: string }>;
  sermons: Array<{ id: string; title: string; speaker: string }>;
  departments: Array<{ id: string; name: string; memberCount: number }>;
  giving: Array<{ id: string; donorName: string; type: string; reference: string; amount: number }>;
  media: any[];
  admins: any[];
  auditLogs: any[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async executeGlobalSearch(query: string, requesterRole?: string): Promise<GlobalSearchResults> {
    const searchString = query.trim();
    if (!searchString) return this.emptyPayload();

    const searchWords = searchString.split(/\s+/).filter(Boolean);

    // Giving records are financial data — only expose to ADMIN/SUPER_ADMIN,
    // never to a plain MEMBER hitting the same search endpoint.
    const canSeeFinancials = requesterRole === 'SUPER_ADMIN' || requesterRole === 'ADMIN';

    const [members, events, rawSermons, departments, giving] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          deletedAt: null,
          AND: searchWords.map((word) => ({
            OR: [
              { firstName: { contains: word, mode: 'insensitive' } },
              { lastName: { contains: word, mode: 'insensitive' } },
              { email: { contains: word, mode: 'insensitive' } },
            ],
          })),
        },
        select: { id: true, firstName: true, lastName: true, email: true, isWorker: true },
        take: 5,
      }),

      // FIXED: Event has no `date`/`day`/`time` columns — only `startDate`/`endDate`.
      // Also now filters deletedAt: null, which the original query omitted.
      this.prisma.event.findMany({
        where: {
          deletedAt: null,
          AND: searchWords.map((word) => ({
            title: { contains: word, mode: 'insensitive' },
          })),
        },
        select: { id: true, title: true, startDate: true },
        take: 5,
      }),

      this.prisma.sermon.findMany({
        where: {
          AND: searchWords.map((word) => ({
            OR: [
              { title: { contains: word, mode: 'insensitive' } },
              { preacher: { contains: word, mode: 'insensitive' } },
            ],
          })),
        },
        select: { id: true, title: true, preacher: true },
        take: 5,
      }),

      this.prisma.department.findMany({
        where: {
          deletedAt: null,
          AND: searchWords.map((word) => ({
            name: { contains: word, mode: 'insensitive' },
          })),
        },
        select: { id: true, name: true, _count: { select: { members: true } } },
        take: 5,
      }),

      canSeeFinancials
        ? this.prisma.giving.findMany({
            where: {
              deletedAt: null,
              AND: searchWords.map((word) => ({
                reference: { contains: word, mode: 'insensitive' },
              })),
            },
            select: {
              id: true,
              type: true,
              reference: true,
              amount: true,
              member: { select: { firstName: true, lastName: true } },
            },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return {
      members,
      sermons: rawSermons.map((s) => ({
        id: s.id,
        title: s.title,
        speaker: s.preacher ?? 'Unknown Speaker',
      })),
      media: [],
      admins: [],
      auditLogs: [],
      // FIXED: was hardcoded "Anonymous Contribution" for every result regardless
      // of whether the giving record actually had a linked member.
      giving: giving.map((g: any) => ({
        id: g.id,
        donorName: g.member ? `${g.member.firstName} ${g.member.lastName}` : 'Anonymous Contribution',
        type: g.type,
        reference: g.reference ?? '',
        amount: Number(g.amount),
      })),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        day: e.startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      })),
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        memberCount: d._count?.members ?? 0,
      })),
    };
  }

  private emptyPayload(): GlobalSearchResults {
    return { members: [], events: [], sermons: [], media: [], departments: [], giving: [], admins: [], auditLogs: [] };
  }
}
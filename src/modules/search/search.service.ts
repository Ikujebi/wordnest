import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// Explicit type layout mapping exactly to the frontend's CommandPalette expected shape
export interface GlobalSearchResults {
  members: Array<{ id: string; firstName: string; lastName: string; email: string | null; isWorker: boolean }>;
  events: Array<{ id: string; title: string; day: string; time: string }>;
  sermons: Array<{ id: string; title: string; speaker: string }>;
  departments: Array<{ id: string; name: string; memberCount: number }>;
  giving: Array<{ id: string; donorName: string; type: string; reference: string; amount: number | string }>;
  media: any[];
  admins: any[];
  auditLogs: any[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async executeGlobalSearch(query: string): Promise<GlobalSearchResults> {
    const searchString = query.trim();
    if (!searchString) {
      return this.emptyPayload();
    }

    // Isolate search terms to natively support non-linear multi-word matches ("Abraham Kehinde")
    const searchWords = searchString.split(/\s+/).filter(Boolean);

    const [members, events, rawSermons, departments, giving] = await Promise.all([
      // 1. Members - Highly targeted column payload selection
      this.prisma.member.findMany({
        where: {
          deletedAt: null,
          AND: searchWords.map(word => ({
            OR: [
              { firstName: { contains: word, mode: 'insensitive' } },
              { lastName: { contains: word, mode: 'insensitive' } },
              { email: { contains: word, mode: 'insensitive' } },
            ],
          })),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isWorker: true,
        },
        take: 5,
      }),

      // 2. Events - Multi-word title lookup
      this.prisma.event.findMany({
        where: {
          AND: searchWords.map(word => ({
            title: { contains: word, mode: 'insensitive' }
          }))
        },
        select: {
          id: true,
          title: true,
          // Pull raw dates to run predictable formatted fallbacks downstream
          date: true, 
          day: true,
          time: true,
        } as any, // Cast temporarily if day/time fields are dynamically parsed
        take: 5,
      }),

      // 3. Sermons - Multi-word cross matches against title and preacher
      this.prisma.sermon.findMany({
        where: {
          AND: searchWords.map(word => ({
            OR: [
              { title: { contains: word, mode: 'insensitive' } },
              { preacher: { contains: word, mode: 'insensitive' } }, // 👈 Updated from speaker to preacher
            ],
          })),
        },
        select: {
          id: true,
          title: true,
          preacher: true, // 👈 Updated from speaker to preacher
        },
        take: 5,
      }),

      // 4. Departments - Strict count extraction without column overheads
      this.prisma.department.findMany({
        where: {
          AND: searchWords.map(word => ({
            name: { contains: word, mode: 'insensitive' }
          }))
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: { members: true },
          },
        },
        take: 5,
      }),

      // 5. Giving - Reference search
      this.prisma.giving.findMany({
        where: {
          deletedAt: null,
          AND: searchWords.map(word => ({
            OR: [
              { reference: { contains: word, mode: 'insensitive' } },
            ],
          })),
        },
        select: {
          id: true,
          type: true,
          reference: true,
          amount: true,
        },
        take: 5,
      }),
    ]);

    return {
      members,
      // Map 'preacher' from Prisma to 'speaker' for frontend contract compatibility
      sermons: rawSermons.map(s => ({
        id: s.id,
        title: s.title,
        speaker: s.preacher ?? 'Unknown Speaker',
      })),
      media: [],
      admins: [],
      auditLogs: [],
      giving: giving.map(g => ({
        id: g.id,
        donorName: 'Anonymous Contribution', 
        type: g.type,
        reference: g.reference ?? '', 
        amount: typeof g.amount === 'object' ? Number(g.amount) : g.amount,
      })),
      events: events.map((e: any) => {
        const fallBackDate = e.date ? new Date(e.date) : new Date();
        return {
          id: e.id,
          title: e.title,
          day: e.day || fallBackDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: e.time || fallBackDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };
      }),
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        memberCount: d._count?.members ?? 0,
      })),
    };
  }

  private emptyPayload(): GlobalSearchResults {
    return {
      members: [],
      events: [],
      sermons: [],
      media: [],
      departments: [],
      giving: [],
      admins: [],
      auditLogs: [],
    };
  }
}
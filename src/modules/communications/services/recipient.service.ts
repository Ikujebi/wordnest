import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';

export interface RecipientFilter {
  type:
    | 'ALL_MEMBERS'
    | 'ALL_SUBSCRIBERS'
    | 'ALL_MEMBERS_AND_SUBSCRIBERS'
    | 'WORKERS'
    | 'DEPARTMENT'
    | 'MINISTRY'
    | 'INDIVIDUAL'
    | 'CUSTOM';

  departmentId?: string;

  ministryId?: string;

  memberIds?: string[];

  emails?: string[];
}

/**
 * Normalized shape every resolver method below returns. `kind` tells
 * attachRecipients() which FK column `id` belongs to — memberId or
 * subscriberId — since a communication recipient can come from either
 * table (or neither, for CUSTOM one-off emails).
 */
interface ResolvedRecipient {
  kind: 'member' | 'subscriber' | 'custom';
  id: string | null;
  email: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  userId: string | null;
}

@Injectable()
export class RecipientService {
  private readonly logger = new Logger(RecipientService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve recipients based on filter
   */
  async resolveRecipients(filter: RecipientFilter): Promise<ResolvedRecipient[]> {
    switch (filter.type) {
      case 'ALL_MEMBERS':
        return this.getAllMembers();

      case 'ALL_SUBSCRIBERS':
        return this.getAllSubscribers();

      case 'ALL_MEMBERS_AND_SUBSCRIBERS':
        return [...(await this.getAllMembers()), ...(await this.getAllSubscribers())];

      case 'WORKERS':
        return this.getWorkers();

      case 'DEPARTMENT':
        if (!filter.departmentId) {
          throw new BadRequestException('Department ID required');
        }
        return this.getDepartmentMembers(filter.departmentId);

      case 'MINISTRY':
        if (!filter.ministryId) {
          throw new BadRequestException('Ministry ID required');
        }
        return this.getMinistryMembers(filter.ministryId);

      case 'INDIVIDUAL':
        return this.getIndividualMembers(filter.memberIds ?? []);

      case 'CUSTOM':
        return this.getCustomRecipients(filter.emails ?? []);

      default:
        throw new BadRequestException('Invalid recipient type');
    }
  }

  /**
   * Everyone with a member profile linked to an active user account.
   */
  private async getAllMembers(): Promise<ResolvedRecipient[]> {
    const members = await this.prisma.member.findMany({
      where: {
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        userId: true,
      },
    });

    return members.map((m) => ({
      kind: 'member' as const,
      id: m.id,
      email: m.email,
      phoneNumber: m.phoneNumber,
      firstName: m.firstName,
      lastName: m.lastName,
      userId: m.userId,
    }));
  }

  /**
   * External newsletter subscribers who haven't unsubscribed.
   */
  private async getAllSubscribers(): Promise<ResolvedRecipient[]> {
    const subscribers = await this.prisma.subscriber.findMany({
      where: {
        isActive: true,
        unsubscribedAt: null,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
      },
    });

    return subscribers.map((s) => ({
      kind: 'subscriber' as const,
      id: s.id,
      email: s.email,
      phoneNumber: s.phoneNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      userId: null,
    }));
  }

  /**
   * Active workers.
   */
  private async getWorkers(): Promise<ResolvedRecipient[]> {
    const workers = await this.prisma.worker.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        member: true,
      },
    });

    return workers.map((w) => ({
      kind: 'member' as const,
      id: w.member.id,
      email: w.member.email,
      phoneNumber: w.member.phoneNumber,
      firstName: w.member.firstName,
      lastName: w.member.lastName,
      userId: w.member.userId,
    }));
  }

  /**
   * Department recipients.
   */
  private async getDepartmentMembers(departmentId: string): Promise<ResolvedRecipient[]> {
    const departmentMembers = await this.prisma.departmentMember.findMany({
      where: {
        departmentId,
        status: 'ACTIVE',
        member: {
          user: {
            isActive: true,
          },
        },
      },
      include: {
        member: true,
      },
    });

    return departmentMembers.map((dm) => ({
      kind: 'member' as const,
      id: dm.member.id,
      email: dm.member.email,
      phoneNumber: dm.member.phoneNumber,
      firstName: dm.member.firstName,
      lastName: dm.member.lastName,
      userId: dm.member.userId,
    }));
  }

  /**
   * Ministry recipients.
   */
  private async getMinistryMembers(ministryId: string): Promise<ResolvedRecipient[]> {
    const workers = await this.prisma.worker.findMany({
      where: {
        ministryId,
        isActive: true,
      },
      include: {
        member: true,
      },
    });

    return workers.map((w) => ({
      kind: 'member' as const,
      id: w.member.id,
      email: w.member.email,
      phoneNumber: w.member.phoneNumber,
      firstName: w.member.firstName,
      lastName: w.member.lastName,
      userId: w.member.userId,
    }));
  }

  /**
   * Specific members by ID.
   */
  private async getIndividualMembers(ids: string[]): Promise<ResolvedRecipient[]> {
    if (!ids.length) {
      return [];
    }

    const members = await this.prisma.member.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        userId: true,
      },
    });

    return members.map((m) => ({
      kind: 'member' as const,
      id: m.id,
      email: m.email,
      phoneNumber: m.phoneNumber,
      firstName: m.firstName,
      lastName: m.lastName,
      userId: m.userId,
    }));
  }

  /**
   * One-off custom email addresses — not tied to any Member or Subscriber
   * record, so they can never receive an IN_APP notification (no userId).
   */
  private async getCustomRecipients(emails: string[]): Promise<ResolvedRecipient[]> {
    return emails.map((email) => ({
      kind: 'custom' as const,
      id: null,
      email,
      phoneNumber: null,
      firstName: null,
      lastName: null,
      userId: null,
    }));
  }

  /**
   * Add recipients to communication
   */
  async attachRecipients(communicationId: string, recipients: ResolvedRecipient[]) {
    if (!recipients.length) {
      return { count: 0 };
    }

    const data = recipients.map((recipient) => ({
      communicationId,
      memberId: recipient.kind === 'member' ? recipient.id : null,
      subscriberId: recipient.kind === 'subscriber' ? recipient.id : null,
      email: recipient.email ?? null,
      phone: recipient.phoneNumber ?? null,
    }));

    await this.prisma.communicationRecipient.createMany({
      data,
      skipDuplicates: true,
    });

    return { count: data.length };
  }

  /**
   * Preview recipient count
   */
  async countRecipients(filter: RecipientFilter) {
    const recipients = await this.resolveRecipients(filter);
    return { count: recipients.length };
  }

  /**
   * Remove duplicates — important for ALL_MEMBERS_AND_SUBSCRIBERS, where
   * the same person could plausibly appear as both a Member and a
   * Subscriber with the same email.
   */
  removeDuplicates(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
    const map = new Map<string, ResolvedRecipient>();

    for (const recipient of recipients) {
      const key = recipient.email ?? recipient.phoneNumber;
      if (key) {
        map.set(key, recipient);
      }
    }

    return Array.from(map.values());
  }
}

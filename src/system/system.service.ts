import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '../modules/audit-log/enums/audit-action.enum';
import { NotificationService } from '../modules/notifications/notification.service';
import { NotificationType } from '@prisma/client';

const execAsync = promisify(exec);

const MAINTENANCE_MODE_KEY = 'maintenanceMode';

export interface MaintenanceModeValue {
  enabled: boolean;
  message: string | null;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Real Node.js process + OS-level metrics.
   */
  getMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const memUsage = process.memoryUsage();

    return {
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model ?? 'unknown',
        loadAverage1m: Number(loadAvg[0].toFixed(2)),
        loadPercent: Math.min(Math.round((loadAvg[0] / cpus.length) * 100), 100),
      },
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        usedPercent: Math.round((usedMem / totalMem) * 100),
        processHeapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        processHeapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: os.platform(),
    };
  }

  /**
   * Health check for core runtime services.
   */
  async getHealth() {
    const [db, cloudinaryStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkCloudinary(),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      services: [db, cloudinaryStatus],
      overallStatus: [db, cloudinaryStatus].every((s) => s.status === 'operational')
        ? 'operational'
        : 'degraded',
    };
  }

  private async checkDatabase() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'Primary Database',
        type: 'PostgreSQL',
        status: 'operational' as const,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error instanceof Error ? error.stack : String(error));
      return {
        name: 'Primary Database',
        type: 'PostgreSQL',
        status: 'down' as const,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkCloudinary() {
    const start = Date.now();
    try {
      await cloudinary.api.ping();
      return {
        name: 'Media Storage',
        type: 'Cloudinary',
        status: 'operational' as const,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Cloudinary health check failed', error instanceof Error ? error.stack : String(error));
      return {
        name: 'Media Storage',
        type: 'Cloudinary',
        status: 'down' as const,
        latencyMs: Date.now() - start,
      };
    }
  }

  async getMaintenanceMode(): Promise<MaintenanceModeValue> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: MAINTENANCE_MODE_KEY },
    });

    if (!setting) {
      return { enabled: false, message: null };
    }

    return setting.value as unknown as MaintenanceModeValue;
  }

  async setMaintenanceMode(enabled: boolean, message: string | undefined, adminId: string) {
    const value: MaintenanceModeValue = { enabled, message: message ?? null };

    const setting = await this.prisma.systemSetting.upsert({
      where: { key: MAINTENANCE_MODE_KEY },
      create: { key: MAINTENANCE_MODE_KEY, value: value as any, updatedById: adminId },
      update: { value: value as any, updatedById: adminId },
    });

    await this.auditLogService.createLog(
      { id: adminId },
      {
        action: AuditAction.UPDATE_DEPARTMENT,
        entity: 'SystemSetting',
        entityId: setting.id,
        description: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
        newValues: value,
      },
    );

    await this.notificationService.notifySuperAdmins({
      title: `Maintenance Mode ${enabled ? 'Enabled' : 'Disabled'}`,
      message: enabled
        ? `The portal is now in maintenance mode. ${message ?? ''}`.trim()
        : 'The portal has exited maintenance mode.',
      type: NotificationType.WARNING,
    });

    return value;
  }

  async triggerBackup(adminId: string) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new InternalServerErrorException('DATABASE_URL is not configured.');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.sql`;
    const filePath = `/tmp/${fileName}`;

    try {
      await execAsync(`pg_dump "${databaseUrl}" -F c -f "${filePath}"`);

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        resource_type: 'raw',
        folder: 'database-backups',
        public_id: fileName,
      });

      await this.auditLogService.createLog(
        { id: adminId },
        {
          action: AuditAction.UPDATE_DEPARTMENT,
          entity: 'SystemBackup',
          description: `Database backup created: ${fileName}`,
          metadata: { url: uploadResult.secure_url, sizeBytes: uploadResult.bytes },
        },
      );

      return {
        fileName,
        url: uploadResult.secure_url,
        sizeBytes: uploadResult.bytes,
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Database backup failed', error?.stderr || error?.stack || String(error));
      throw new InternalServerErrorException(
        'Backup failed. Ensure pg_dump is installed on the server and DATABASE_URL is correct.',
      );
    } finally {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch((err) => {
          this.logger.warn(`Failed to clean up temp file ${filePath}`, err);
        });
      }
    }
  }

  async getRecentActivity(limit = 10) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        description: true,
        success: true,
        createdAt: true,
        userEmail: true,
      },
    });
  }
}
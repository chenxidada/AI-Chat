import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 基础健康检查
   */
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * 数据库健康检查
   */
  async checkDatabase() {
    try {
      const isConnected = await this.prisma.healthCheck();
      const hasPgVector = await this.prisma.checkPgVector();

      return {
        status: isConnected ? 'ok' : 'error',
        database: isConnected ? 'connected' : 'disconnected',
        pgvector: hasPgVector ? 'installed' : 'not installed',
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 所有服务状态检查
   */
  async checkAllServices() {
    const dbStatus = await this.checkDatabase();
    const meiliStatus = await this.checkMeilisearch();

    const allOk = dbStatus.status === 'ok' && meiliStatus.status === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'ok' },
        database: dbStatus,
        meilisearch: meiliStatus,
      },
    };
  }

  /**
   * Meilisearch 健康检查
   */
  private async checkMeilisearch(): Promise<{ status: string; message?: string }> {
    const meiliHost = this.config.get<string>('meilisearch.host', 'http://localhost:7700');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${meiliHost}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { status: 'ok', message: 'connected' };
      } else {
        return { status: 'error', message: `HTTP ${response.status}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Meilisearch health check failed: ${message}`);
      return { status: 'error', message };
    }
  }
}

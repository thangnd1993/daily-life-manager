import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Check API and dependency health' })
  @ApiOkResponse({ description: 'API, PostgreSQL, and Redis are healthy' })
  async check(): Promise<{
    status: string;
    services: { database: string; redis: string };
  }> {
    try {
      await Promise.all([this.prisma.isHealthy(), this.queue.isHealthy()]);
      return { status: 'ok', services: { database: 'up', redis: 'up' } };
    } catch {
      throw new ServiceUnavailableException(
        'A required service is unavailable',
      );
    }
  }
}

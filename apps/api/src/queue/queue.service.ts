import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redis: IORedis;
  constructor(config: ConfigService) {
    this.redis = new IORedis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }
  async isHealthy(): Promise<boolean> {
    if (this.redis.status === 'wait') await this.redis.connect();
    return (await this.redis.ping()) === 'PONG';
  }
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'wait' && this.redis.status !== 'end')
      await this.redis.quit();
  }
}

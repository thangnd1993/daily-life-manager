import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { NotificationDeliveryService } from './notification-delivery.service';

const QUEUE_NAME = 'notification-delivery';
@Injectable()
export class NotificationJobsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationJobsService.name);
  private queue?: Queue;
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService,
    private readonly delivery: NotificationDeliveryService,
  ) {}
  async onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    };
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(
      QUEUE_NAME,
      (job) => this.delivery.deliver(String(job.data.notificationId)),
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) =>
      this.logger.warn(
        `Notification job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      ),
    );
  }
  async enqueue(notificationId: string) {
    if (!this.queue) return;
    await this.queue.add(
      'deliver',
      { notificationId },
      {
        jobId: `notification-${notificationId}`,
        attempts: 4,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    );
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}

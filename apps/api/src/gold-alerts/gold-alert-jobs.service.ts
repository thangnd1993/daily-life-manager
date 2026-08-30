import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { GoldService } from '../gold/gold.service';
import { GoldAlertsService } from './gold-alerts.service';

const QUEUE_NAME = 'gold-alert-evaluation';
const SCHEDULER_ID = 'gold-alert-evaluation-15m';

@Injectable()
export class GoldAlertJobsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GoldAlertJobsService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly gold: GoldService,
    private readonly alerts: GoldAlertsService,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    };
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(QUEUE_NAME, (job) => this.process(job), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Gold alert job ${job?.id ?? 'unknown'} failed`, error),
    );
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: 15 * 60_000 },
      {
        name: 'refresh-and-evaluate',
        data: {},
        opts: this.options(),
      },
    );
  }

  async enqueueManual() {
    if (!this.queue) return this.alerts.evaluate();
    const job = await this.queue.add(
      'refresh-and-evaluate',
      {},
      { ...this.options(), jobId: `manual-${Date.now()}` },
    );
    return { queued: true, jobId: job.id };
  }

  async process(job: Pick<Job, 'name' | 'data'>) {
    if (job.name !== 'refresh-and-evaluate' || Object.keys(job.data).length)
      throw new Error('Malformed gold alert job');
    try {
      await this.gold.refresh();
    } catch (error) {
      this.logger.warn(
        `Gold refresh failed; evaluating existing snapshots: ${String(error)}`,
      );
    }
    return this.alerts.evaluate();
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private options() {
    return {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    };
  }
}

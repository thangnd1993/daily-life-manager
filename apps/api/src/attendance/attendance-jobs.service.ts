import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { AttendanceService } from './attendance.service';

const QUEUE_NAME = 'attendance-daily-work';
const SCHEDULER_ID = 'attendance-daily-work-hourly';

@Injectable()
export class AttendanceJobsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AttendanceJobsService.name);
  private queue?: Queue;
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService,
    private readonly attendance: AttendanceService,
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
      this.logger.error(`Attendance job ${job?.id ?? 'unknown'} failed`, error),
    );
    const intervalMinutes = this.config.get<number>(
      'ATTENDANCE_AUTO_INTERVAL_MINUTES',
      60,
    );
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: intervalMinutes * 60_000 },
      {
        name: 'record-eligible-local-days',
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      },
    );
  }
  process(job: Pick<Job, 'name' | 'data'>) {
    if (
      job.name !== 'record-eligible-local-days' ||
      Object.keys(job.data).length
    )
      throw new Error('Malformed attendance job');
    return this.attendance.runAutomatic();
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}

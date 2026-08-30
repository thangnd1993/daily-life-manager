import { GoldAlertJobsService } from './gold-alert-jobs.service';

describe('GoldAlertJobsService', () => {
  const config = { get: jest.fn(() => 'test') };
  const gold = { refresh: jest.fn() };
  const alerts = { evaluate: jest.fn() };
  const service = new GoldAlertJobsService(
    config as never,
    gold as never,
    alerts as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('evaluates stored prices even when provider refresh fails', async () => {
    gold.refresh.mockRejectedValue(new Error('provider unavailable'));
    alerts.evaluate.mockResolvedValue({ evaluated: 2, triggered: 1 });
    await expect(
      service.process({ name: 'refresh-and-evaluate', data: {} } as never),
    ).resolves.toEqual({ evaluated: 2, triggered: 1 });
  });

  it('rejects malformed job names and payloads', async () => {
    await expect(
      service.process({
        name: 'other',
        data: { providerUrl: 'evil' },
      } as never),
    ).rejects.toThrow('Malformed gold alert job');
  });

  it('manual evaluation is available without Redis in tests', async () => {
    alerts.evaluate.mockResolvedValue({ evaluated: 0, triggered: 0 });
    await expect(service.enqueueManual()).resolves.toEqual({
      evaluated: 0,
      triggered: 0,
    });
  });
});

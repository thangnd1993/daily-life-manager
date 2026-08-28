import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports healthy dependencies', async () => {
    const controller = new HealthController(
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
    );
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      services: { database: 'up', redis: 'up' },
    });
  });
});

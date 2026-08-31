import { PushPlatform } from '@prisma/client';
import { PushDevicesService } from './push-devices.service';

describe('PushDevicesService', () => {
  const prisma = {
    pushDevice: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new PushDevicesService(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('registers idempotently by unique token and derives owner from caller', async () => {
    prisma.pushDevice.upsert.mockResolvedValue({
      id: 'd1',
      platform: PushPlatform.ANDROID,
      isActive: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.register('user-1', {
      platform: PushPlatform.ANDROID,
      pushToken: 'token-value-that-is-long-enough',
    });
    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pushToken: 'token-value-that-is-long-enough' },
        update: expect.objectContaining({ userId: 'user-1', isActive: true }),
      }),
    );
    expect(result).not.toHaveProperty('pushToken');
  });
  it('blocks cross-user deactivation', async () => {
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.deactivate('other-user', 'd1')).rejects.toThrow(
      'Push device not found',
    );
  });
});

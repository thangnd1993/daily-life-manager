import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGoldController, GoldController } from './gold.controller';

describe('Gold authorization', () => {
  it('requires authentication for latest and history', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, GoldController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('requires ADMIN for provider refresh', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminGoldController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(new Reflector().get(ROLES_KEY, AdminGoldController)).toEqual([
      UserRole.ADMIN,
    ]);
  });
});

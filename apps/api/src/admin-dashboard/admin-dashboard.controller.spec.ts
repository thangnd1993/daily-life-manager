import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminDashboardController } from './admin-dashboard.controller';

describe('AdminDashboardController authorization', () => {
  it('requires an authenticated ADMIN for every reporting endpoint', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, AdminDashboardController)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminDashboardController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });
});

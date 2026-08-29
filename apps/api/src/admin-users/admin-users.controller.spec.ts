import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUsersController } from './admin-users.controller';

describe('AdminUsersController authorization', () => {
  it('requires authentication and ADMIN role for every endpoint', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, AdminUsersController)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminUsersController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});

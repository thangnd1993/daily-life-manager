import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditController } from './audit.controller';

describe('AuditController authorization', () => {
  it('requires authentication and the ADMIN role', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, AuditController)).toEqual([UserRole.ADMIN]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});

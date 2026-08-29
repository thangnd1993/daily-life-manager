import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdminFinanceController,
  AdminFinanceInsightsController,
  FinanceController,
} from './finance.controller';

describe('Finance authorization', () => {
  it('requires authentication for personal finance endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FinanceController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('requires ADMIN role for selected-user finance inspection', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminFinanceController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(new Reflector().get(ROLES_KEY, AdminFinanceController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('requires ADMIN role for selected-user budget analytics', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminFinanceInsightsController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(
      new Reflector().get(ROLES_KEY, AdminFinanceInsightsController),
    ).toEqual([UserRole.ADMIN]);
  });
});

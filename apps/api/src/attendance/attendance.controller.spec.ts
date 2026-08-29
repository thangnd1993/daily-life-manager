import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdminAttendanceController,
  AttendanceController,
} from './attendance.controller';

describe('Attendance authorization', () => {
  it('requires authentication for user attendance endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AttendanceController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('requires authentication and ADMIN role for selected-user inspection', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminAttendanceController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(new Reflector().get(ROLES_KEY, AdminAttendanceController)).toEqual([
      UserRole.ADMIN,
    ]);
  });
});

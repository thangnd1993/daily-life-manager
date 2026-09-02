import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { auditContext } from '../audit/audit.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUsersService } from './admin-users.service';
import { AdminUserDetail, PaginatedUsers } from './admin-users.types';
import {
  ListUsersQueryDto,
  UpdateAttendanceEnabledDto,
  UpdateUserStatusDto,
} from './dto/admin-users.dto';

@ApiTags('admin users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users with server-side filtering and pagination',
  })
  @ApiOkResponse({ description: 'Paginated safe user records' })
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsers> {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a safe user account detail' })
  detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change account status; role remains read-only' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: Request,
  ): Promise<AdminUserDetail> {
    return this.users.updateStatus(
      actor,
      id,
      dto.status,
      auditContext(request),
    );
  }

  @Patch(':id/attendance')
  updateAttendance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceEnabledDto,
    @Req() request: Request,
  ): Promise<AdminUserDetail> {
    return this.users.updateAttendanceEnabled(
      actor,
      id,
      dto.enabled,
      auditContext(request),
    );
  }
}

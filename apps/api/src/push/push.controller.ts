import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegisterPushDeviceDto } from './dto/push-device.dto';
import { PushDevicesService } from './push-devices.service';

@ApiTags('push devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push/devices')
export class PushController {
  constructor(private readonly devices: PushDevicesService) {}
  @Post()
  @ApiOperation({ summary: 'Register or reactivate the current user device' })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.devices.register(user.id, dto);
  }
  @Get()
  @ApiOperation({ summary: "List the current user's push devices" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.list(user.id);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an owned push device' })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.devices.deactivate(user.id, id);
  }
}

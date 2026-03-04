import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '基础健康检查' })
  @ApiResponse({ status: 200, description: '服务正常' })
  check() {
    return this.healthService.check();
  }

  @Get('db')
  @ApiOperation({ summary: '数据库连接检查' })
  @ApiResponse({ status: 200, description: '数据库连接正常' })
  checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('services')
  @ApiOperation({ summary: '所有服务状态检查' })
  @ApiResponse({ status: 200, description: '所有服务状态' })
  checkAllServices() {
    return this.healthService.checkAllServices();
  }
}

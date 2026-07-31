import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { GivingsService } from './givings.service';
import { RecordGivingDto } from './dto/record-giving.dto';
import { UpdateGivingDto } from './dto/update-giving.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('givings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GivingsController {
  constructor(private readonly givingsService: GivingsService) {}

  @Post('ledger')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async logTransaction(@Req() req: any, @Body() recordGivingDto: RecordGivingDto) {
    return this.givingsService.recordTransaction(recordGivingDto, req.user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('memberId') memberId?: string,
    @Query('search') search?: string,
  ) {
    return this.givingsService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      memberId,
      search,
    });
  }

  @Get('metrics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async viewFinancialMetrics(@Req() req: any) {
    return this.givingsService.getFinancialMetrics(req.user.id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateGivingDto: UpdateGivingDto,
  ) {
    return this.givingsService.updateGiving(id, updateGivingDto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.givingsService.deleteGiving(id, req.user.id);
  }

  @Post(':id/refund')
  @Roles(Role.SUPER_ADMIN)
  async refund(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.givingsService.refundGiving(id, req.user.id);
  }
}
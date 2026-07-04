import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { GivingsService } from './givings.service';
import { RecordGivingDto } from './dto/record-giving.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('givings')
@UseGuards(JwtAuthGuard)
export class GivingsController {
  constructor(private readonly givingsService: GivingsService) {}

  @Post('ledger')
  async logTransaction(@Body() recordGivingDto: RecordGivingDto) {
    return this.givingsService.recordTransaction(recordGivingDto);
  }

  @Get('metrics')
  async viewFinancialMetrics() {
    return this.givingsService.getFinancialMetrics();
  }
}
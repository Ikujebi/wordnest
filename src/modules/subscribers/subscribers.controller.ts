import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscribersService } from './subscribers.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { Public } from '../../auth/decorators/public.decorator';

@Public()
@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } }) // same tier as contact-form/register — public write, abuse-prone
  subscribe(@Body() dto: SubscribeDto) {
    return this.subscribersService.subscribe(dto);
  }

  @Get('unsubscribe')
  unsubscribe(@Query('token') token: string) {
    return this.subscribersService.unsubscribe(token);
  }
  @Get('count')
  getCount() {
    return this.subscribersService.getActiveCount();
  }
}
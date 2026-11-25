import { Controller, Get } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { AnalyticsService, FinanceAnalyticsDto } from './analytics.service';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('finance')
  finance(@Me() me: Member): Promise<FinanceAnalyticsDto> {
    return this.analytics.finance(me);
  }
}

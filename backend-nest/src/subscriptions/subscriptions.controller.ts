import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { SubscriptionsService, SubscriptionDto } from './subscriptions.service';

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Me() me: Member): Promise<SubscriptionDto[]> {
    return this.subscriptions.list(me);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: Parameters<SubscriptionsService['create']>[1]): Promise<void> {
    return this.subscriptions.create(me, body ?? {});
  }

  @Patch(':id')
  @HttpCode(200)
  setStatus(@Me() me: Member, @Param('id') id: string, @Body() body: { status?: string }): Promise<void> {
    return this.subscriptions.setStatus(me, id, body?.status);
  }

  @Post(':id/bill')
  @HttpCode(201)
  async bill(@Me() me: Member, @Param('id') id: string): Promise<void> {
    await this.subscriptions.bill(me, id);
  }

  @Post('bill-due')
  @HttpCode(200)
  async billDue(@Me() me: Member): Promise<{ invoices: number }> {
    return { invoices: await this.subscriptions.billDue(me) };
  }
}

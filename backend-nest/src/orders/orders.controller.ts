import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { OrdersService, OrderDto, OrderInput } from './orders.service';
import { InvoicesService } from '../invoices/invoices.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly invoices: InvoicesService) {}

  @Get()
  list(@Me() me: Member): Promise<OrderDto[]> {
    return this.orders.list(me);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: OrderInput): Promise<void> {
    return this.orders.create(me, body ?? {});
  }

  @Patch(':id')
  @HttpCode(200)
  setStatus(@Me() me: Member, @Param('id') id: string, @Body() body: { status?: string }): Promise<void> {
    return this.orders.setStatus(me, id, body?.status);
  }

  @Post(':id/invoice')
  @HttpCode(201)
  invoice(@Me() me: Member, @Param('id') id: string): Promise<void> {
    return this.invoices.createFromOrder(me, id);
  }
}

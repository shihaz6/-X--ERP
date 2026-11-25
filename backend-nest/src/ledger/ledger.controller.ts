import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { LedgerService } from './ledger.service';

@Controller('api/transactions')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list(
    @Me() me: Member,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(25), ParseIntPipe) size: number,
  ) {
    return this.ledger.page(me, page, size);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: Parameters<LedgerService['create']>[1]): Promise<void> {
    return this.ledger.create(me, body ?? {});
  }
}

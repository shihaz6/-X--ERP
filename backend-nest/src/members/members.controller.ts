import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { MembersService, MemberCreateInput, MemberUpdateInput, MemberDto } from './members.service';

@Controller('api/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(): Promise<MemberDto[]> {
    return this.members.list();
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: MemberCreateInput): Promise<MemberDto> {
    return this.members.create(me, body ?? ({} as MemberCreateInput));
  }

  @Patch(':id')
  update(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: MemberUpdateInput): Promise<MemberDto> {
    return this.members.update(me, id, body ?? {});
  }
}

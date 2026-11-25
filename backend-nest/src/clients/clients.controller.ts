import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { ClientsService, ClientDto, ClientInput } from './clients.service';

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Me() me: Member): Promise<ClientDto[]> {
    return this.clients.list(me);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: ClientInput): Promise<void> {
    return this.clients.create(me, body ?? {});
  }

  @Patch(':id')
  @HttpCode(200)
  update(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: ClientInput): Promise<void> {
    return this.clients.update(me, id, body ?? {});
  }

  @Delete(':id')
  @HttpCode(200)
  delete(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clients.delete(me, id);
  }

  @Post(':id/notes')
  @HttpCode(201)
  addNote(
    @Me() me: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { type?: string; text?: string },
  ): Promise<void> {
    return this.clients.addNote(me, id, body ?? {});
  }
}

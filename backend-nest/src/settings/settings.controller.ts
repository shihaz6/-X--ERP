import { Body, Controller, Get, HttpCode, Patch, Put } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { SettingsService, SettingsDto, SettingsInput } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SettingsDto> {
    return this.settings.get();
  }

  @Patch()
  @HttpCode(200)
  update(@Me() me: Member, @Body() body: SettingsInput): Promise<void> {
    return this.settings.update(me, body ?? {});
  }

  @Put('services')
  @HttpCode(200)
  services(@Me() me: Member, @Body() body: { services?: string[] }): Promise<void> {
    return this.settings.replaceServices(me, body?.services);
  }
}

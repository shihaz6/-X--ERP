import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { Permissions, requireAccess } from '../common/permissions';
import { AuditService, AuditDto, PageDto } from './audit.service';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Me() me: Member,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(50), ParseIntPipe) size: number,
  ): Promise<PageDto<AuditDto>> {
    requireAccess(Permissions.admin(me.role), 'Only a Super Admin can view the audit log.');
    return this.audit.page(page, size);
  }
}

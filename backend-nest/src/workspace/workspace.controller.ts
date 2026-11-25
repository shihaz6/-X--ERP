import { Controller, Get } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { WorkspaceService } from './workspace.service';

@Controller('api')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('workspace')
  workspaceSnapshot(@Me() me: Member) {
    return this.workspace.snapshot(me);
  }
}

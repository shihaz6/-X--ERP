import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { TeamService, TimesheetEntryDto, TimesheetSubmissionDto, LeaveDto } from './team.service';

@Controller('api')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('timesheets')
  timesheets(@Me() me: Member, @Query('weekStart') weekStart: string): Promise<TimesheetEntryDto[]> {
    return this.team.timesheet(me, weekStart);
  }

  @Put('timesheets')
  @HttpCode(200)
  saveTimesheets(@Me() me: Member, @Body() body: Parameters<TeamService['saveTimesheet']>[1]): Promise<void> {
    return this.team.saveTimesheet(me, body ?? {});
  }

  @Post('timesheets/submit')
  @HttpCode(200)
  submit(@Me() me: Member, @Body() body: { weekStart?: string }): Promise<void> {
    return this.team.submitTimesheet(me, body?.weekStart);
  }

  @Get('timesheets/submissions')
  submissions(@Query('weekStart') weekStart: string): Promise<TimesheetSubmissionDto[]> {
    return this.team.submissions(weekStart);
  }

  @Post('timesheets/:memberId/:weekStart/decision')
  @HttpCode(200)
  decide(
    @Me() me: Member,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('weekStart') weekStart: string,
    @Body() body: { status?: string },
  ): Promise<void> {
    return this.team.decideWeek(me, memberId, weekStart, body?.status);
  }

  @Get('leave')
  leave(): Promise<LeaveDto[]> {
    return this.team.leaves();
  }

  @Post('leave')
  @HttpCode(201)
  requestLeave(@Me() me: Member, @Body() body: { type?: string; from?: string; to?: string }): Promise<void> {
    return this.team.requestLeave(me, body ?? {});
  }

  @Patch('leave/:id')
  @HttpCode(200)
  decideLeave(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: string }): Promise<void> {
    return this.team.decideLeave(me, id, body?.status);
  }
}

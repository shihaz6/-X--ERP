import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Me } from '../auth/current-member.decorator';
import { Member } from '../common/member';
import { ProjectsService, ProjectDto, ProjectInput } from './projects.service';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Me() me: Member): Promise<ProjectDto[]> {
    return this.projects.list(me);
  }

  @Post()
  @HttpCode(201)
  create(@Me() me: Member, @Body() body: ProjectInput): Promise<void> {
    return this.projects.create(me, body ?? {});
  }

  @Patch(':id')
  @HttpCode(200)
  setStatus(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: { status?: string }): Promise<void> {
    return this.projects.setStatus(me, id, body?.status);
  }

  @Delete(':id')
  @HttpCode(200)
  delete(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.projects.delete(me, id);
  }

  @Post(':id/team')
  @HttpCode(200)
  assign(@Me() me: Member, @Param('id', ParseUUIDPipe) id: string, @Body() body: { memberId?: string }): Promise<void> {
    return this.projects.assignMember(me, id, body?.memberId);
  }

  @Post(':id/tasks')
  @HttpCode(201)
  addTask(
    @Me() me: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { title?: string; assigneeId?: string | null; due?: string },
  ): Promise<void> {
    return this.projects.addTask(me, id, body ?? {});
  }

  @Patch(':id/tasks/:taskId')
  @HttpCode(200)
  moveTask(
    @Me() me: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: { status?: string },
  ): Promise<void> {
    return this.projects.moveTask(me, id, taskId, body?.status);
  }

  @Patch(':id/milestones/:milestoneId')
  @HttpCode(200)
  milestone(
    @Me() me: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() body: { paid?: boolean },
  ): Promise<void> {
    return this.projects.setMilestonePaid(me, id, milestoneId, body?.paid === true);
  }
}

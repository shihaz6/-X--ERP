import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Member } from '../common/member';

/** Injects the signed-in member, set by AuthGuard. */
export const Me = createParamDecorator((_: unknown, ctx: ExecutionContext): Member => {
  const req = ctx.switchToHttp().getRequest<Request & { member?: Member }>();
  return req.member as Member;
});

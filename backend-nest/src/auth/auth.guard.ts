import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { unauthorized } from '../common/errors';
import { IS_PUBLIC } from './public.decorator';
import { AuthService } from './auth.service';

/**
 * Requires a valid bearer token on every route except those marked @Public().
 * Stores the signed-in member and the raw token on the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { member?: unknown; token?: string }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const member = token ? await this.auth.resolve(token) : null;
    if (!member) throw unauthorized('Sign in to continue');

    req.member = member;
    req.token = token ?? undefined;
    return true;
  }
}

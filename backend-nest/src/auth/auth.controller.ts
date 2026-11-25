import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig, CONFIG } from '../config.provider';
import { Me } from './current-member.decorator';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { MembersService, MemberDto } from '../members/members.service';
import { Member } from '../common/member';
import { unauthorized } from '../common/errors';
import { stampIn } from '../common/time';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
    private readonly members: MembersService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username?: string; password?: string }) {
    const result = await this.auth.login(body?.username ?? '', body?.password ?? '');
    return {
      token: result.token,
      expiresAt: stampIn(result.expiresAt, this.config.timezone),
      member: await this.members.dto(result.member),
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request & { token?: string }): Promise<void> {
    await this.auth.logout(req.token);
  }

  @Get('me')
  me(@Me() me: Member): Promise<MemberDto> {
    if (!me) throw unauthorized('Sign in to continue');
    return this.members.dto(me);
  }

  /** Always answers the same way, so it cannot reveal which emails have accounts. */
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: { email?: string }): Promise<void> {
    await this.resets.request(body?.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: { token?: string; password?: string }): Promise<void> {
    await this.resets.reset(body?.token, body?.password);
  }
}

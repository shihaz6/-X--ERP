import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { BootstrapService } from './bootstrap.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    BootstrapService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}

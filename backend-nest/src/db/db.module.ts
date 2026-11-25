import { Global, Module } from '@nestjs/common';
import { configProvider } from '../config.provider';
import { Db } from './db.service';

@Global()
@Module({
  providers: [configProvider, Db],
  exports: [configProvider, Db],
})
export class DbModule {}

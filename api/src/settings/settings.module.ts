import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from './admin.guard';
import { AppSetting } from './app-setting.model';
import { AppUserRole } from './app-user-role.model';
import { PlatformSettingsService } from './platform-settings.service';
import { SettingsResolver } from './settings.resolver';

@Module({
  imports: [
    AuthModule,
    SequelizeModule.forFeature([AppSetting, AppUserRole]),
  ],
  providers: [AdminGuard, PlatformSettingsService, SettingsResolver],
  exports: [AdminGuard, PlatformSettingsService],
})
export class SettingsModule {}

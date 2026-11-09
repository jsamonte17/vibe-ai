import {
  Args,
  Context,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenPayload } from '../auth/auth.types';
import { AdminGuard } from './admin.guard';
import { PlatformSettingsService } from './platform-settings.service';
import {
  AdminUserResult,
  CurrentUserResult,
  PlatformSettingsResult,
  UpdatePlatformSettingsInput,
} from './platform-settings.types';

@Resolver()
export class SettingsResolver {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Query('currentUser')
  @UseGuards(AuthGuard)
  async currentUser(
    @Context() context: { user?: AuthTokenPayload },
  ): Promise<CurrentUserResult> {
    const user = context.user!;
    return {
      username: user.username,
      isAdmin: await this.platformSettingsService.isAdministrator(user.username),
    };
  }

  @Query('platformSettings')
  @UseGuards(AuthGuard, AdminGuard)
  platformSettings(): Promise<PlatformSettingsResult> {
    return this.platformSettingsService.getInstructions();
  }

  @Query('adminUsers')
  @UseGuards(AuthGuard, AdminGuard)
  adminUsers(): Promise<AdminUserResult[]> {
    return this.platformSettingsService.findAdministrators();
  }

  @Mutation('updatePlatformSettings')
  @UseGuards(AuthGuard, AdminGuard)
  updatePlatformSettings(
    @Args('input') input: UpdatePlatformSettingsInput,
  ): Promise<PlatformSettingsResult> {
    return this.platformSettingsService.updateInstructions(input);
  }

  @Mutation('setAdministratorRole')
  @UseGuards(AuthGuard, AdminGuard)
  setAdministratorRole(
    @Args('username') username: string,
    @Args('isAdmin') isAdmin: boolean,
  ): Promise<AdminUserResult[]> {
    return this.platformSettingsService.setAdministratorRole(
      username,
      isAdmin,
    );
  }
}

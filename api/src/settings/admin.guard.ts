import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthTokenPayload } from '../auth/auth.types';
import { PlatformSettingsService } from './platform-settings.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      user?: AuthTokenPayload;
    }>();
    const username = gqlContext.user?.username;
    if (
      !username ||
      !(await this.platformSettingsService.isAdministrator(username))
    ) {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}

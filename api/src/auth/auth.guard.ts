import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req?: { headers?: Record<string, string>; user?: unknown };
      connectionParams?: Record<string, unknown>;
      extra?: { request?: { headers?: Record<string, string> } };
      user?: unknown;
    }>();
    const authorization =
      gqlContext.req?.headers?.authorization ??
      gqlContext.extra?.request?.headers?.authorization ??
      gqlContext.connectionParams?.authorization ??
      gqlContext.connectionParams?.Authorization;
    const match =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(.+)$/i)
        : undefined;
    if (!match) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const user = await this.authService.verifyAccessToken(match[1]);
    gqlContext.user = user;
    if (gqlContext.req) {
      gqlContext.req.user = user;
    }
    return true;
  }
}

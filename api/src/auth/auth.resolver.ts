import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthPayload } from './auth.types';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation('login')
  login(
    @Args('username') username: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(username, password);
  }
}

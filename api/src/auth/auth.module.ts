import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthResolver, AuthService, AuthGuard],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}

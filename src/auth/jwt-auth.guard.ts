import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context) {
    this.logger.debug('JWT authentication check initiated');
    const result = super.canActivate(context);
    this.logger.debug(`JWT authentication result: ${result ? 'success' : 'failed'}`);
    return result;
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.warn(`JWT authentication failed - Error: ${err?.message || 'Unknown error'}, Info: ${info?.message || 'No info'}`);
      return super.handleRequest(err, user, info);
    }
    
    this.logger.log(`JWT authentication successful for user: ${user.email || user.sub} (Role: ${user.role})`);
    return user;
  }
}

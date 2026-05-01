import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { updatePreferencesSchema } from './preferences.dto';
import { PreferencesService } from './preferences.service';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly preferencesService: PreferencesService,
  ) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.getCurrentUser(request.auth.clerkUserId);
  }

  @Get('me/preferences')
  @UseGuards(ClerkAuthGuard)
  getPreferences(@Req() request: AuthenticatedRequest) {
    return this.preferencesService.getPreferences(request.auth.clerkUserId);
  }

  @Patch('me/preferences')
  @UseGuards(ClerkAuthGuard)
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    let parsed;
    try {
      parsed = updatePreferencesSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(
          error.issues.map((issue) => issue.message).join(', '),
        );
      }
      throw error;
    }

    return this.preferencesService.updatePreferences(
      request.auth.clerkUserId,
      parsed,
    );
  }
}

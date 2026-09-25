import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { loadMasteryHistory } from './load-mastery-history';
import { getHome } from './get-home';

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getMasteryHistory(
    clerkUserId: string,
    before: string,
    timeZone?: string,
  ) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    return loadMasteryHistory(this.prisma, user.id, before, timeZone);
  }

  async getHome(clerkUserId: string, timeZone?: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    return getHome({ prisma: this.prisma, user, timeZone });
  }
}

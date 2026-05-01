import type { UserPreferences } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdatePreferencesRequest } from './preferences.dto';
import { UsersService } from './users.service';

export type PreferencesPayload = {
  translateTargetLang: string | null;
  interfaceLang: string | null;
  theme: string | null;
  fontScale: number | null;
  readingGoalMinutes: number | null;
};

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getPreferences(clerkUserId: string): Promise<PreferencesPayload> {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const row = await this.prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    return this.serialize(row);
  }

  async updatePreferences(
    clerkUserId: string,
    patch: UpdatePreferencesRequest,
  ): Promise<PreferencesPayload> {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const data = this.toPrismaWriteData(patch);

    const row = await this.prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });

    return this.serialize(row);
  }

  // The DTO uses `field?: T | null | undefined`. `undefined` ⇒ omit from the
  // write so Prisma leaves the column alone. `null` and concrete values both
  // pass through — Prisma accepts `null` as "set to NULL" on a nullable column.
  private toPrismaWriteData(patch: UpdatePreferencesRequest) {
    const data: Record<string, string | number | null> = {};
    if (patch.translateTargetLang !== undefined) {
      data.translateTargetLang = patch.translateTargetLang;
    }
    if (patch.interfaceLang !== undefined) {
      data.interfaceLang = patch.interfaceLang;
    }
    if (patch.theme !== undefined) {
      data.theme = patch.theme;
    }
    if (patch.fontScale !== undefined) {
      data.fontScale = patch.fontScale;
    }
    if (patch.readingGoalMinutes !== undefined) {
      data.readingGoalMinutes = patch.readingGoalMinutes;
    }
    return data;
  }

  private serialize(row: UserPreferences | null): PreferencesPayload {
    return {
      translateTargetLang: row?.translateTargetLang ?? null,
      interfaceLang: row?.interfaceLang ?? null,
      theme: row?.theme ?? null,
      fontScale: row?.fontScale ?? null,
      readingGoalMinutes: row?.readingGoalMinutes ?? null,
    };
  }
}

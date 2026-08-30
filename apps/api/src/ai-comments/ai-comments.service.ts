import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OpenRouterClient } from '../shared/openrouter-client';
import type {
  AiCommentListItem,
  AiToolGenerationResult,
  GenerateInput,
} from './ai-comment-types';
import { deleteAiComment } from './comments/delete-comment';
import { listAiComments } from './comments/list-comments';
import { generateAiComment } from './generate/generate-comment';
import { requireOwnedLibraryItem } from './library-item-access';

@Injectable()
export class AiCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async list(
    clerkUserId: string,
    libraryItemId: string,
  ): Promise<AiCommentListItem[]> {
    const owned = await this.ownedLibraryItem(clerkUserId, libraryItemId);
    return listAiComments({ ...owned, prisma: this.prisma });
  }

  async remove(input: {
    clerkUserId: string;
    libraryItemId: string;
    id: string;
  }): Promise<void> {
    const owned = await this.ownedLibraryItem(
      input.clerkUserId,
      input.libraryItemId,
    );
    return deleteAiComment({ ...owned, id: input.id, prisma: this.prisma });
  }

  async generate(input: GenerateInput): Promise<AiToolGenerationResult> {
    const owned = await this.ownedLibraryItem(
      input.clerkUserId,
      input.libraryItemId,
    );
    return generateAiComment({
      ...owned,
      openrouter: this.openrouter,
      prisma: this.prisma,
      request: input,
    });
  }

  private ownedLibraryItem(clerkUserId: string, libraryItemId: string) {
    return requireOwnedLibraryItem({
      clerkUserId,
      libraryItemId,
      prisma: this.prisma,
      users: this.users,
    });
  }
}

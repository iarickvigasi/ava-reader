import type { Express } from 'express';
import { BlobPurpose } from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async submitFeedback(
    clerkUserId: string,
    message: unknown,
    attachment?: Express.Multer.File,
  ) {
    if (typeof message !== 'string' || message.trim().length < 4) {
      throw new BadRequestException(
        'Feedback must include at least a short message.',
      );
    }

    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const submission = await this.prisma.$transaction(async (tx) => {
      const attachmentBlob = attachment
        ? await tx.storedBlob.create({
            data: {
              purpose: BlobPurpose.FEEDBACK_ATTACHMENT,
              mimeType: attachment.mimetype || 'application/octet-stream',
              sizeBytes: attachment.size,
              originalFilename: attachment.originalname,
              checksum: checksumBuffer(attachment.buffer),
              bytes: toPrismaBytes(attachment.buffer),
            },
          })
        : null;

      return tx.feedbackSubmission.create({
        data: {
          userId: user.id,
          message: message.trim(),
          attachmentBlobId: attachmentBlob?.id,
        },
      });
    });

    return {
      createdAt: submission.createdAt.toISOString(),
      id: submission.id,
      status: 'received',
    };
  }
}

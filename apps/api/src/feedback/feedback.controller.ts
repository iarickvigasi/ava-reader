import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(FileInterceptor('attachment'))
  submitFeedback(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() attachment?: Express.Multer.File,
  ) {
    const body = request.body as { message?: unknown };

    return this.feedbackService.submitFeedback(
      request.auth.clerkUserId,
      body.message,
      attachment,
    );
  }
}

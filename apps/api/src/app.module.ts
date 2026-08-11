import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiCommentsController } from './ai-comments/ai-comments.controller';
import { AiCommentsService } from './ai-comments/ai-comments.service';
import { OpenRouterClient } from './shared/openrouter-client';
import { AnnotationsController } from './annotations/annotations.controller';
import { BookAnalysisService } from './book-analysis/book-analysis.service';
import { AnnotationsService } from './annotations/annotations.service';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { ClerkAuthService } from './auth/clerk-auth.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { FeedbackController } from './feedback/feedback.controller';
import { FeedbackService } from './feedback/feedback.service';
import { HomeController } from './home/home.controller';
import { HomeService } from './home/home.service';
import { LibraryController } from './library/library.controller';
import { LibraryService } from './library/library.service';
import { OrphanBlobCleanupService } from './library/orphan-blob-cleanup.service';
import { PrismaService } from './prisma/prisma.service';
import { ReaderController } from './reader/reader.controller';
import { ReaderProcessingService } from './reader/reader-processing.service';
import { ReaderService } from './reader/reader.service';
import { PreferencesService } from './users/preferences.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppController,
    UsersController,
    HomeController,
    LibraryController,
    ReaderController,
    CatalogController,
    FeedbackController,
    AiCommentsController,
    AnnotationsController,
  ],
  providers: [
    AppService,
    PrismaService,
    ClerkAuthGuard,
    ClerkAuthService,
    UsersService,
    PreferencesService,
    HomeService,
    LibraryService,
    OrphanBlobCleanupService,
    ReaderService,
    ReaderProcessingService,
    CatalogService,
    FeedbackService,
    AiCommentsService,
    OpenRouterClient,
    AnnotationsService,
    BookAnalysisService,
  ],
})
export class AppModule {}

import { NarrationController } from './narration/narration.controller';
import { ReadingOperatorController } from './catalog/reading-import/reading-operator.controller';
import { ReadingOperatorGuard } from './catalog/reading-import/reading-operator.guard';
import { ReadingUnpublishController } from './catalog/reading-import/reading-unpublish.controller';
import { ReadingDetailsController } from './catalog/reading-details.controller';
import { PrivateCatalogLinksController } from './library/catalog-link/private-catalog-links.controller';
import { CatalogLinkController } from './library/catalog-link/catalog-link.controller';
import { EditionWorkController } from './catalog/editorial/edition-work.controller';
import { EditorialController } from './catalog/editorial/editorial.controller';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiCommentsController } from './ai-comments/ai-comments.controller';
import { AiCommentsService } from './ai-comments/ai-comments.service';
import { AiToolboxController } from './ai-comments/ai-toolbox.controller';
import { OpenRouterClient } from './shared/openrouter-client';
import { AnnotationsController } from './annotations/annotations.controller';
import { BookAnalysisService } from './book-analysis/book-analysis.service';
import { BookTranslationsController } from './book-translations/book-translations.controller';
import { BookTranslationsService } from './book-translations/book-translations.service';
import { AnnotationsService } from './annotations/annotations.service';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { ClerkAuthService } from './auth/clerk-auth.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ReviewsController } from './catalog/reading-import/reviews.controller';
import { PublicationSyncService } from './catalog/publication/publication-sync.service';
import { ReadingImportController } from './catalog/reading-import/reading-import.controller';
import { ReadingImportService } from './catalog/reading-import/reading-import.service';
import { FeedbackController } from './feedback/feedback.controller';
import { FeedbackService } from './feedback/feedback.service';
import { HomeController } from './home/home.controller';
import { HomeService } from './home/home.service';
import { LibraryController } from './library/library.controller';
import { LibraryService } from './library/library.service';
import { CollectionMembershipController } from './library/membership/collection-membership.controller';
import { OrphanBlobCleanupService } from './library/orphan-blob-cleanup.service';
import { PrismaService } from './prisma/prisma.service';
import { ReaderController } from './reader/reader.controller';
import { ReaderProcessingService } from './reader/reader-processing.service';
import { ReaderService } from './reader/reader.service';
import { PreferencesService } from './users/preferences/preferences.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    NarrationController,
    ReadingDetailsController,
    AppController,
    UsersController,
    HomeController,
    LibraryController,
    CollectionMembershipController,
    ReaderController,
    CatalogController,
    EditorialController,
    EditionWorkController,
    CatalogLinkController,
    PrivateCatalogLinksController,
    ReviewsController,
    ReadingImportController,
    ReadingOperatorController,
    ReadingUnpublishController,
    FeedbackController,
    AiCommentsController,
    AiToolboxController,
    AnnotationsController,
    BookTranslationsController,
  ],
  providers: [
    AppService,
    PrismaService,
    ClerkAuthGuard,
    ReadingOperatorGuard,
    ClerkAuthService,
    UsersService,
    PreferencesService,
    HomeService,
    LibraryService,
    OrphanBlobCleanupService,
    ReaderService,
    ReaderProcessingService,
    CatalogService,
    PublicationSyncService,
    ReadingImportService,
    FeedbackService,
    AiCommentsService,
    OpenRouterClient,
    AnnotationsService,
    BookAnalysisService,
    BookTranslationsService,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PrismaService } from './prisma/prisma.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppController,
    UsersController,
    HomeController,
    LibraryController,
    CatalogController,
    FeedbackController,
  ],
  providers: [
    AppService,
    PrismaService,
    ClerkAuthGuard,
    ClerkAuthService,
    UsersService,
    HomeService,
    LibraryService,
    CatalogService,
    FeedbackService,
  ],
})
export class AppModule {}

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthorsService } from './authors.service';

@Controller('authors')
export class AuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.authors.find(id);
  }

  @Get(':id/works')
  works(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string,
  ) {
    return this.authors.works(id, cursor);
  }
}

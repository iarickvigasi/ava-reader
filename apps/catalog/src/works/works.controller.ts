import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { WorksService } from './works.service';

@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.works.find(id);
  }

  @Get(':id/editions')
  editions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string,
  ) {
    return this.works.editions(id, cursor);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertPersonProfileDto } from './dto/upsert-person-profile.dto';
import { PersonProfilesService } from './person-profiles.service';

@UseGuards(JwtAuthGuard)
@Controller('person-profiles')
export class PersonProfilesController {
  constructor(private readonly personProfilesService: PersonProfilesService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.personProfilesService.list(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: UpsertPersonProfileDto) {
    return this.personProfilesService.create(userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpsertPersonProfileDto,
  ) {
    return this.personProfilesService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.personProfilesService.remove(userId, id);
  }
}

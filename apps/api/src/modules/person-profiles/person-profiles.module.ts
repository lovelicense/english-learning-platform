import { Module } from '@nestjs/common';
import { PersonProfilesController } from './person-profiles.controller';
import { PersonProfilesService } from './person-profiles.service';

@Module({
  controllers: [PersonProfilesController],
  providers: [PersonProfilesService],
  exports: [PersonProfilesService],
})
export class PersonProfilesModule {}

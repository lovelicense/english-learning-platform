import { Module } from '@nestjs/common';
import { ExpressionsController } from './expressions.controller';
import { ExpressionsService } from './expressions.service';

@Module({ controllers: [ExpressionsController], providers: [ExpressionsService] })
export class ExpressionsModule {}

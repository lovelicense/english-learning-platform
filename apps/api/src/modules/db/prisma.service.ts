import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }


  async enableShutdownHooks(app: INestApplication) {
    // Prisma 버전 타입 충돌 회피용
    // 필요 시 추후 process signal 기반 종료 처리로 대체
  }
}

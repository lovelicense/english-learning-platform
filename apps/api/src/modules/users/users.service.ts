import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('이미 존재하는 이메일입니다.');
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({ data: { email, passwordHash } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }
}

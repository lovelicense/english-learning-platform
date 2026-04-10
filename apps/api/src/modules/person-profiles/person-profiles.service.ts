import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class PersonProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return (this.prisma as any).personProfile.findMany({
      where: { userId },
      orderBy: [{ isMe: 'desc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, input: {
    name: string;
    roleLabel?: string;
    relationshipToMe?: string;
    aliases?: string;
    notes?: string;
    isMe?: boolean;
  }) {
    if (input.isMe) {
      await (this.prisma as any).personProfile.updateMany({
        where: { userId, isMe: true },
        data: { isMe: false },
      });
    }

    return (this.prisma as any).personProfile.create({
      data: {
        userId,
        name: input.name.trim(),
        roleLabel: input.roleLabel?.trim() || null,
        relationshipToMe: input.relationshipToMe?.trim() || null,
        aliases: input.aliases?.trim() || null,
        notes: input.notes?.trim() || null,
        isMe: input.isMe ?? false,
      },
    });
  }

  async update(userId: string, id: string, input: {
    name: string;
    roleLabel?: string;
    relationshipToMe?: string;
    aliases?: string;
    notes?: string;
    isMe?: boolean;
  }) {
    const existing = await (this.prisma as any).personProfile.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('인물 프로필을 찾을 수 없습니다.');

    if (input.isMe) {
      await (this.prisma as any).personProfile.updateMany({
        where: { userId, isMe: true, NOT: { id } },
        data: { isMe: false },
      });
    }

    return (this.prisma as any).personProfile.update({
      where: { id },
      data: {
        name: input.name.trim(),
        roleLabel: input.roleLabel?.trim() || null,
        relationshipToMe: input.relationshipToMe?.trim() || null,
        aliases: input.aliases?.trim() || null,
        notes: input.notes?.trim() || null,
        isMe: input.isMe ?? false,
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await (this.prisma as any).personProfile.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('인물 프로필을 찾을 수 없습니다.');

    await this.prisma.$transaction([
      (this.prisma as any).recordingParticipant.deleteMany({
        where: { personProfileId: id },
      }),
      (this.prisma as any).recordingSpeakerProfile.deleteMany({
        where: { personProfileId: id },
      }),
      (this.prisma as any).personProfile.delete({
        where: { id },
      }),
    ]);

    return { success: true, id };
  }
}

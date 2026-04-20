import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportsService } from './exports.service';

@UseGuards(JwtAuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('assets/:assetType')
  async exportAssets(
    @CurrentUser('userId') userId: string,
    @Param('assetType') assetType: 'korean' | 'english',
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res({ passthrough: true }) res: any,
  ) {
    const normalizedAssetType = assetType === 'english' ? 'english' : 'korean';
    const normalizedFormat = format === 'csv' ? 'csv' : 'json';
    const exported = await this.exportsService.exportAssets(userId, normalizedAssetType, normalizedFormat);

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    return exported.body;
  }
}

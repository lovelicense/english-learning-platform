import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.AWS_S3_BUCKET ?? 'dev-bucket';
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  buildAudioKey(fileName: string) {
    return `recordings/raw/${Date.now()}-${fileName}`;
  }

  buildPracticeAudioKey(fileName: string) {
    return `practice/raw/${Date.now()}-${fileName}`;
  }

  async createPresignedUpload(fileName: string, contentType = 'audio/webm') {
    const key = this.buildAudioKey(fileName);
    return this.createPresignedUploadForKey(key, contentType);
  }

  async createPresignedUploadForKey(key: string, contentType = 'audio/webm') {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    return { key, uploadUrl };
  }

  async createPracticePresignedUpload(fileName: string, contentType = 'audio/webm') {
    const key = this.buildPracticeAudioKey(fileName);
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    return { key, uploadUrl };
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
    return { key };
  }

  async getObjectBuffer(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async createPresignedDownload(key: string, expiresIn = 3600, responseContentType?: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: responseContentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  getPublicUrl(key: string) {
    if (process.env.CLOUDFRONT_DOMAIN) return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
    return `https://${this.bucket}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  }
}

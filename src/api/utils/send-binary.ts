import fs from 'node:fs';
import { Response } from 'express';

export async function sendBinaryFile(
  res: Response,
  filePath: string,
  contentType: string,
  filename: string,
): Promise<void> {
  const stat = await fs.promises.stat(filePath);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: import.meta.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY,
  },
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert File to Buffer
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `battle-images/${timestamp}-${image.name}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: import.meta.env.R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: image.type,
      ACL: 'public-read',
    });

    await s3Client.send(command);

    // Construct the public URL
    const imageUrl = `${import.meta.env.R2_DEV_URL}/${filename}`;

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}; 
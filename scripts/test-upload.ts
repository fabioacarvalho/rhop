import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(base64Data, 'base64');
  const caminho = `screenshots/test-${Date.now()}.png`;

  console.log('Creating bucket...');
  const { error: bucketError } = await supabase.storage.createBucket('issues', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif'],
    fileSizeLimit: 10485760, // 10MB
  });
  
  if (bucketError && !bucketError.message.includes('already exists') && bucketError.name !== 'Duplicate') {
    console.log('Bucket creation error (might already exist):', bucketError);
  }

  console.log('Uploading to Supabase...');
  const { data, error } = await supabase.storage.from('issues').upload(caminho, buffer, {
    contentType: 'image/png',
    upsert: true,
  });

  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload successful:', data);
    const { data: publicUrlData } = supabase.storage.from('curriculos').getPublicUrl(caminho);
    console.log('Public URL:', publicUrlData.publicUrl);
  }
}

testUpload();

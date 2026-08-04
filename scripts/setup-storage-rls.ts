import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing supabase url or service role key");
    process.exit(1);
  }

  // Use service role key to execute raw SQL (via a postgres function if possible, or we can just try via postgres connection? wait, Supabase REST API doesn't allow executing arbitrary SQL directly unless using rpc)
  // Actually, I can't easily create policies via REST API without a function.
  // Wait, I have the DATABASE_URL in .env! I can connect directly to PostgreSQL and run the SQL!
  
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  await client.connect();
  
  const sql = `
    -- Enable access to the anexos bucket for authenticated users
    CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'anexos' );

    CREATE POLICY "Allow public reads"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'anexos' );
  `;
  
  try {
    await client.query(sql);
    console.log("Policies created successfully.");
  } catch (err: any) {
    console.error("Error creating policies:", err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

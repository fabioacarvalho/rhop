import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing supabase url or service role key");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.storage.createBucket("anexos", {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    fileSizeLimit: 5242880, // 5MB
  });

  if (error) {
    console.error("Error creating bucket (might already exist):", error.message);
  } else {
    console.log("Bucket created successfully:", data);
  }
}

main().catch(console.error);

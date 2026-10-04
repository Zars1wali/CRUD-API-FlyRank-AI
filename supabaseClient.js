const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_KEY is not defined in .env. Please set them up in your .env file.");
}

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-anon-key"
);

module.exports = supabase;

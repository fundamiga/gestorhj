const { createClient } = require('@supabase/supabase-js');

const url = "https://gimldpldmkqvgizkczrs.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpbWxkcGxkbWtxdmdpemtjenJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTU2ODMsImV4cCI6MjA5MzQ3MTY4M30.mbglIzc7rGPS37A5AgBr1soYNdOK7bXr-vfJUdQBx4s";

console.log('Probando conexión a:', url);
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('❌ ERROR:', error.message);
  } else {
    console.log('✅ ÉXITO! Buckets:', data.map(b => b.name));
  }
}
test();

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

// auth.users 삭제는 Supabase Admin API(서비스 롤 키)로만 가능해, 정적 프런트엔드에서
// 유일하게 서버가 필요한 작업이다. GitHub Pages가 아니라 Supabase Edge Function으로 처리한다.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'DELETE') return json({ error: '허용되지 않은 요청입니다.' }, 405);

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return json({ error: '로그인이 필요합니다.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return json({ error: '서버 설정이 완료되지 않았습니다.' }, 503);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: '로그인이 필요합니다.' }, 401);

  const adminClient = createClient(url, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(callerData.user.id);
  if (deleteError) return json({ error: '계정을 삭제하지 못했습니다.' }, 500);

  return json({ success: true }, 200);
});

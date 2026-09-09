import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './server';

export async function authenticateRequest(request: Request): Promise<{
  user: User;
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>;
} | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const client = createServerSupabaseClient();
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, client };
}

export async function authenticateAdminRequest(request: Request) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return null;
  const { data } = await authenticated.client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', authenticated.user.id)
    .maybeSingle();
  return data ? authenticated : null;
}

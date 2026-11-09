// app/services/blocks.ts
// Blocking in chat. The database refuses messages between blocked people.
import { supabase } from '../lib/supabase';

export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
  return new Set((data || []).map(r => r.blocked_id as string));
}

export async function blockUser(userId: string, otherId: string) {
  const { error } = await supabase.from('user_blocks').upsert({ blocker_id: userId, blocked_id: otherId });
  if (error) throw error;
}

export async function unblockUser(userId: string, otherId: string) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId);
  if (error) throw error;
}

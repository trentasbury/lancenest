import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptMessage } from '../../../../lib/messageCrypto';

export async function GET(req, { params }) {
  const { id } = params;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('freelancer_id, client_id, profiles!conversations_freelancer_id_fkey(full_name), client:profiles!conversations_client_id_fkey(full_name)')
    .eq('id', id)
    .single();

  if (!conversation || (conversation.freelancer_id !== user.id && conversation.client_id !== user.id)) {
    return NextResponse.json({ error: 'Not part of this conversation.' }, { status: 403 });
  }

  const { data: rows } = await supabaseAdmin
    .from('conversation_messages')
    .select('id, sender_id, body_encrypted, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const messages = (rows || []).map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    created_at: row.created_at,
    body: decryptMessage(row.body_encrypted),
  }));

  const otherName = conversation.freelancer_id === user.id
    ? conversation.client?.full_name
    : conversation.profiles?.full_name;

  return NextResponse.json({ messages, otherName });
}

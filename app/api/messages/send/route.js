import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { encryptMessage } from '../../../../lib/messageCrypto';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { conversationId, body } = await req.json();
  if (!conversationId || !body?.trim()) {
    return NextResponse.json({ error: 'Missing message content.' }, { status: 400 });
  }

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('freelancer_id, client_id')
    .eq('id', conversationId)
    .single();

  if (!conversation || (conversation.freelancer_id !== user.id && conversation.client_id !== user.id)) {
    return NextResponse.json({ error: 'Not part of this conversation.' }, { status: 403 });
  }

  const encrypted = encryptMessage(body.trim());

  const { data: message, error: insertError } = await supabaseAdmin
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body_encrypted: encrypted,
    })
    .select('id, sender_id, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: { ...message, body: body.trim() },
  });
}

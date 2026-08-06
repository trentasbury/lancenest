import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { otherUserId } = await req.json();
  if (!otherUserId || otherUserId === user.id) {
    return NextResponse.json({ error: 'Invalid recipient.' }, { status: 400 });
  }

  const [{ data: me }, { data: other }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('id, role').eq('id', otherUserId).single(),
  ]);

  if (!me || !other) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  let freelancerId, clientId;
  if (me.role === 'freelancer' && other.role === 'client') {
    freelancerId = me.id;
    clientId = other.id;
  } else if (me.role === 'client' && other.role === 'freelancer') {
    freelancerId = other.id;
    clientId = me.id;
  } else {
    return NextResponse.json({ error: 'Messaging is only between a freelancer and a client.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('freelancer_id', freelancerId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ conversationId: existing.id });
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('conversations')
    .insert({ freelancer_id: freelancerId, client_id: clientId })
    .select('id')
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId: created.id });
}

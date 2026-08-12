'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FollowButton({ targetId }) {
  const [userId, setUserId] = useState(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || user.id === targetId) {
        setChecking(false);
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle();

      setFollowing(!!data);
      setChecking(false);
    }
    load();
  }, [targetId]);

  async function toggleFollow() {
    if (!userId) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);

    if (following) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
      setFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
      setFollowing(true);
    }
    setLoading(false);
  }

  if (checking || (userId && userId === targetId)) return null;

  return (
    <button
      className={following ? 'btn btn-outline' : 'btn btn-primary'}
      onClick={toggleFollow}
      disabled={loading}
    >
      {loading ? '...' : following ? 'Following' : 'Follow'}
    </button>
  );
}

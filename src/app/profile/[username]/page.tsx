"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type GalleryPost = Database["public"]["Tables"]["gallery_posts"]["Row"];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!profileData) { setLoading(false); return; }
      setProfile(profileData);

      const { data: postsData } = await supabase
        .from("gallery_posts")
        .select("*")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      setPosts(postsData ?? []);
      setLoading(false);
    }
    fetchProfile();
  }, [username, supabase]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">불러오는 중...</div>;
  if (!profile) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">유저를 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-white font-bold overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            profile.username[0].toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">{profile.username}</h1>
          {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
        </div>
      </div>

      <h2 className="text-white font-semibold mb-4">작품 {posts.length}</h2>
      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-12">아직 올린 작품이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <img src={post.image_url} alt={post.title} className="w-full object-cover max-h-64" loading="lazy" />
              <div className="p-4">
                <h3 className="text-white font-medium text-sm">{post.title}</h3>
                {post.description && (
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{post.description}</p>
                )}
                <p className="text-gray-600 text-xs mt-2">
                  {new Date(post.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

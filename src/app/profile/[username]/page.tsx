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
        .from("profiles").select("*").eq("username", username).single();
      if (!profileData) { setLoading(false); return; }
      setProfile(profileData);
      const { data: postsData } = await supabase
        .from("gallery_posts").select("*").eq("user_id", profileData.id).order("created_at", { ascending: false });
      setPosts(postsData ?? []);
      setLoading(false);
    }
    fetchProfile();
  }, [username, supabase]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8 text-[#6B7280]">불러오는 중...</div>;
  if (!profile) return <div className="max-w-3xl mx-auto px-4 py-8 text-[#6B7280]">유저를 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 프로필 헤더 */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EBF2FF] flex items-center justify-center text-[#3478FF] text-2xl font-bold overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              profile.username[0].toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-[#141415] text-xl font-bold">{profile.username}</h1>
            {profile.bio && <p className="text-[#6B7280] text-sm mt-1">{profile.bio}</p>}
            <p className="text-[#9CA3AF] text-xs mt-1">작품 {posts.length}개</p>
          </div>
        </div>
      </div>

      {/* 작품 그리드 */}
      <h2 className="text-[#141415] font-semibold mb-4">작품</h2>
      {posts.length === 0 ? (
        <p className="text-[#9CA3AF] text-sm text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
          아직 올린 작품이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-[4/3] overflow-hidden bg-[#F8F9FA]">
                <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-4">
                <h3 className="text-[#141415] font-medium text-sm">{post.title}</h3>
                {post.description && (
                  <p className="text-[#6B7280] text-xs mt-1 line-clamp-1">{post.description}</p>
                )}
                <p className="text-[#9CA3AF] text-xs mt-2">
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

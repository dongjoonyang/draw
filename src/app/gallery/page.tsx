"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type FeedPost = Database["public"]["Views"]["gallery_feed"]["Row"];

export default function GalleryPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [likeLoading, setLikeLoading] = useState<Set<string>>(new Set());
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setCurrentUserId(uid);

      const { data: postsData } = await supabase
        .from("gallery_feed")
        .select("*")
        .order("created_at", { ascending: false });
      setPosts(postsData ?? []);

      if (uid) {
        const { data: likesData } = await supabase
          .from("likes")
          .select("*")
          .eq("user_id", uid)
          .eq("post_type", "gallery");
        setUserLikes(new Set(likesData?.map((l) => l.post_id) ?? []));
      }
      setLoading(false);
    }
    init();
  }, [supabase]);

  const toggleLike = async (postId: string) => {
    if (!currentUserId) { router.push("/auth/login"); return; }
    setLikeLoading((prev) => new Set(prev).add(postId));

    if (userLikes.has(postId)) {
      await supabase.from("likes").delete()
        .eq("user_id", currentUserId).eq("post_id", postId).eq("post_type", "gallery");
      setUserLikes((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) - 1 } : p));
    } else {
      await supabase.from("likes").insert({ user_id: currentUserId, post_id: postId, post_type: "gallery" });
      setUserLikes((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) + 1 } : p));
    }
    setLikeLoading((prev) => { const n = new Set(prev); n.delete(postId); return n; });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#141415]">갤러리</h1>
        <Link
          href="/gallery/upload"
          className="text-sm bg-[#3478FF] hover:bg-[#1A5FD4] text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          작품 올리기
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-[#E5E7EB]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#6B7280] text-sm mb-4">아직 작품이 없습니다.</p>
          <Link href="/gallery/upload" className="text-[#3478FF] hover:text-[#1A5FD4] text-sm font-medium">
            첫 번째 작품을 올려보세요 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#F8F9FA]">
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h2 className="text-[#141415] font-semibold text-sm mb-1">{post.title}</h2>
                {post.description && (
                  <p className="text-[#6B7280] text-xs line-clamp-1 mb-3">{post.description}</p>
                )}
                <div className="flex items-center gap-3 text-[#9CA3AF] text-xs">
                  <Link
                    href={`/profile/${post.username}`}
                    className="text-[#6B7280] hover:text-[#3478FF] font-medium transition-colors"
                  >
                    {post.username}
                  </Link>
                  <button
                    onClick={() => toggleLike(post.id)}
                    disabled={likeLoading.has(post.id)}
                    aria-label={userLikes.has(post.id) ? "좋아요 취소" : "좋아요"}
                    className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                      userLikes.has(post.id) ? "text-red-500" : "hover:text-red-400"
                    }`}
                  >
                    {userLikes.has(post.id) ? "♥" : "♡"} {post.likes_count}
                  </button>
                  <span>댓글 {post.comments_count}</span>
                  <span className="ml-auto">
                    {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

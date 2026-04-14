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
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", currentUserId)
        .eq("post_id", postId)
        .eq("post_type", "gallery");
      setUserLikes((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) - 1 } : p)
      );
    } else {
      await supabase
        .from("likes")
        .insert({ user_id: currentUserId, post_id: postId, post_type: "gallery" });
      setUserLikes((prev) => new Set(prev).add(postId));
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) + 1 } : p)
      );
    }

    setLikeLoading((prev) => { const n = new Set(prev); n.delete(postId); return n; });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">갤러리</h1>
        <Link
          href="/gallery/upload"
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          작품 올리기
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-sm mb-4">아직 작품이 없습니다.</p>
          <Link href="/gallery/upload" className="text-indigo-400 hover:text-indigo-300 text-sm">
            첫 번째 작품을 올려보세요 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full object-cover max-h-96"
                loading="lazy"
              />
              <div className="p-4">
                <h2 className="text-white font-semibold">{post.title}</h2>
                {post.description && (
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{post.description}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-gray-500 text-sm">
                  <Link
                    href={`/profile/${post.username}`}
                    className="hover:text-gray-300 transition-colors"
                  >
                    {post.username}
                  </Link>
                  <button
                    onClick={() => toggleLike(post.id)}
                    disabled={likeLoading.has(post.id)}
                    aria-label={userLikes.has(post.id) ? "좋아요 취소" : "좋아요"}
                    className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                      userLikes.has(post.id) ? "text-red-400" : "hover:text-red-400"
                    }`}
                  >
                    {userLikes.has(post.id) ? "♥" : "♡"} {post.likes_count}
                  </button>
                  <span>댓글 {post.comments_count}</span>
                  <span className="ml-auto text-xs">
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

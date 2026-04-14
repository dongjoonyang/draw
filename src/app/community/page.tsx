"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type FeedPost = Database["public"]["Views"]["community_feed"]["Row"];

export default function CommunityPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from("community_feed")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) setPosts(data ?? []);
      setLoading(false);
    }
    fetchPosts();
  }, [supabase]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">커뮤니티</h1>
        <Link
          href="/community/new"
          className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          글쓰기
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-sm mb-4">아직 게시글이 없습니다.</p>
          <Link href="/community/new" className="text-indigo-400 hover:text-indigo-300 text-sm">
            첫 글을 남겨보세요 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block bg-gray-900 rounded-xl px-5 py-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <h2 className="text-white font-medium text-sm mb-2 line-clamp-1">{post.title}</h2>
              <div className="flex items-center gap-3 text-gray-500 text-xs">
                <span>{post.username}</span>
                <span>댓글 {post.comments_count}</span>
                <span className="ml-auto">
                  {new Date(post.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

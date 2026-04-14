"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["community_posts"]["Row"] & {
  profiles: { username: string } | null;
};
type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles: { username: string } | null;
};

export default function CommunityPostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id ?? null);
    });

    async function fetchData() {
      const [{ data: postData }, { data: commentData }] = await Promise.all([
        supabase
          .from("community_posts")
          .select("*, profiles(username)")
          .eq("id", id)
          .single(),
        supabase
          .from("comments")
          .select("*, profiles(username)")
          .eq("post_id", id)
          .eq("post_type", "community")
          .order("created_at", { ascending: true }),
      ]);

      setPost(postData as unknown as Post);
      setComments((commentData as Comment[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, [id, supabase]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { router.push("/auth/login"); return; }
    setSubmitting(true);

    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({
        user_id: currentUser,
        post_id: id,
        post_type: "community",
        content: commentText,
      })
      .select("*")
      .single();

    if (!error && inserted) {
      const { data: withProfile } = await supabase
        .from("comments")
        .select("*, profiles(username)")
        .eq("id", inserted.id)
        .single();
      if (withProfile) setComments((prev) => [...prev, withProfile as unknown as Comment]);
      setCommentText("");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">불러오는 중...</div>;
  if (!post) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/community" className="text-gray-500 hover:text-gray-300 text-sm mb-6 inline-block">
        ← 목록으로
      </Link>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
        <h1 className="text-white text-xl font-bold mb-3">{post.title}</h1>
        <div className="flex items-center gap-3 text-gray-500 text-sm mb-6 pb-4 border-b border-gray-800">
          <Link href={`/profile/${post.profiles?.username}`} className="hover:text-gray-300">
            {post.profiles?.username}
          </Link>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      <div>
        <h2 className="text-white font-semibold mb-4">댓글 {comments.length}</h2>
        <div className="space-y-3 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-gray-900 rounded-xl px-5 py-4 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 text-sm font-medium">{comment.profiles?.username}</span>
                <span className="text-gray-600 text-xs">
                  {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>

        {currentUser ? (
          <form onSubmit={handleComment} className="flex gap-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              required
              rows={2}
              placeholder="댓글을 입력하세요"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {submitting ? "..." : "등록"}
            </button>
          </form>
        ) : (
          <p className="text-center text-gray-500 text-sm py-4">
            <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">로그인</Link>
            {" "}후 댓글을 남길 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}

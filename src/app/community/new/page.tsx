"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function CommunityNewPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setAuthChecked(true);
    });
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.push("/auth/login"); return; }

    const { error } = await supabase.from("community_posts").insert({
      user_id: userData.user.id,
      title,
      content,
    });

    if (error) { setError("게시글 저장 실패: " + error.message); setLoading(false); }
    else { router.push("/community"); router.refresh(); }
  };

  if (!authChecked) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-[#141415] mb-8">글쓰기</h1>
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#141415] mb-1.5">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="제목을 입력하세요"
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#141415] mb-1.5">내용 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={12}
              placeholder="내용을 입력하세요"
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors resize-none"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] rounded-lg py-2.5 text-sm transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#3478FF] hover:bg-[#1A5FD4] disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

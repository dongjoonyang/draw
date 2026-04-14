"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function GalleryUploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setAuthChecked(true);
    });
  }, [supabase, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("이미지를 선택해주세요."); return; }
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.push("/auth/login"); return; }

    const ext = file.name.split(".").pop();
    const fileName = `${userData.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("gallery-images").upload(fileName, file);
    if (uploadError) { setError("이미지 업로드 실패: " + uploadError.message); setLoading(false); return; }

    const { data: urlData } = supabase.storage.from("gallery-images").getPublicUrl(fileName);
    const { error: insertError } = await supabase.from("gallery_posts").insert({
      user_id: userData.user.id,
      image_url: urlData.publicUrl,
      title,
      description: description || null,
    });

    if (insertError) { setError("저장 실패: " + insertError.message); setLoading(false); return; }
    router.push("/gallery");
    router.refresh();
  };

  if (!authChecked) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-[#141415] mb-8">작품 올리기</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 왼쪽: 이미지 드롭존 */}
          <div>
            <label className="block text-sm font-medium text-[#141415] mb-2">이미지</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#E5E7EB] hover:border-[#3478FF] rounded-xl cursor-pointer transition-colors overflow-hidden bg-white"
            >
              {preview ? (
                <img src={preview} alt="preview" className="w-full aspect-square object-contain bg-[#F8F9FA]" />
              ) : (
                <div className="aspect-square flex flex-col items-center justify-center text-[#9CA3AF]">
                  <span className="text-4xl mb-3">+</span>
                  <span className="text-sm">클릭하여 이미지 선택</span>
                  <span className="text-xs mt-1">JPG, PNG, WebP</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 오른쪽: 입력 폼 */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={100}
                placeholder="작품 제목"
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">설명 (선택)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="작품에 대한 설명을 남겨주세요"
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors resize-none"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3478FF] hover:bg-[#1A5FD4] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? "업로드 중..." : "올리기"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

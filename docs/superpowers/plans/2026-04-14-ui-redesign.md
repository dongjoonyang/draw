# UI 라이트 테마 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다크 테마를 Postype 스타일 라이트 테마로 전환. 상단 Navbar를 좌측 사이드바로 교체하고 전체 페이지 UI 리프레시.

**Architecture:** 사이드바(`Sidebar.tsx`) + 모바일 하단탭(`BottomNav.tsx`)을 신규 생성하고 `layout.tsx`에서 Navbar 대신 사용. 각 페이지는 Tailwind 클래스만 수정 (기능 로직 변경 없음).

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS

---

## 색상 상수 (모든 Task에서 참고)

| 역할 | 클래스 / 값 |
|------|-------------|
| 페이지 배경 | `bg-[#F8F9FA]` |
| 카드/사이드바 배경 | `bg-white` |
| 포인트 | `bg-[#3478FF]` / `text-[#3478FF]` |
| 포인트 hover | `hover:bg-[#1A5FD4]` |
| 포인트 연한 배경 | `bg-[#EBF2FF]` |
| 텍스트 primary | `text-[#141415]` |
| 텍스트 secondary | `text-[#6B7280]` |
| border | `border-[#E5E7EB]` |
| 카드 shadow | `shadow-sm` (`0 1px 3px rgba(0,0,0,0.08)`) |
| 카드 hover shadow | `hover:shadow-md` |

---

## 파일 구조

```
신규 생성:
  src/components/Sidebar.tsx       ← 데스크탑 사이드바 (Navbar 대체)
  src/components/BottomNav.tsx     ← 모바일 하단 탭바

수정:
  src/app/globals.css              ← 배경색, body 색상 변경
  src/app/layout.tsx               ← Navbar → Sidebar+BottomNav
  src/app/gallery/page.tsx         ← 2열 그리드 카드
  src/app/gallery/upload/page.tsx  ← 2단 레이아웃 + 라이트 폼
  src/app/community/page.tsx       ← 라이트 카드 리스트
  src/app/community/new/page.tsx   ← 라이트 폼
  src/app/community/[id]/page.tsx  ← 라이트 상세 + 댓글
  src/app/auth/login/page.tsx      ← 흰 카드 폼
  src/app/auth/signup/page.tsx     ← 흰 카드 폼
  src/app/profile/[username]/page.tsx ← 라이트 프로필
```

---

## Task 1: globals.css + layout.tsx 기반 설정

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: globals.css 수정**

`src/app/globals.css` 전체를 아래로 교체:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: layout.tsx 수정**

`src/app/layout.tsx` 전체를 아래로 교체:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Dream - 아트 플랫폼",
  description: "그림 연습, 공유, 소통을 위한 아트 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-[#F8F9FA] text-[#141415]">
        <div className="flex min-h-screen">
          {/* 데스크탑 사이드바 */}
          <Sidebar />
          {/* 메인 콘텐츠 */}
          <main className="flex-1 min-w-0 pb-16 md:pb-0">
            {children}
          </main>
        </div>
        {/* 모바일 하단 탭 */}
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: 라이트 테마 기반 레이아웃 설정"
```

---

## Task 2: Sidebar 컴포넌트

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Sidebar.tsx 생성**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[#EBF2FF] text-[#3478FF]"
          : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415]"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.id)
          .single() as { data: { username?: string } | null; error: unknown };
        setUsername((profile as { username?: string } | null)?.username ?? u.email?.split("@")[0] ?? null);
      }
    }
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.id)
          .single() as { data: { username?: string } | null; error: unknown };
        setUsername((profile as { username?: string } | null)?.username ?? u.email?.split("@")[0] ?? null);
      } else {
        setUsername(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-r border-[#E5E7EB] fixed top-0 left-0 bottom-0 z-40">
      {/* 로고 */}
      <div className="px-4 py-5 border-b border-[#E5E7EB]">
        <Link href="/" className="text-[#3478FF] font-bold text-xl">
          Dream
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem href="/gallery" label="갤러리" icon="🖼" />
        <NavItem href="/community" label="커뮤니티" icon="💬" />
        <NavItem href="/figure-drawing" label="인체도형화" icon="✏️" />
      </nav>

      {/* 유저 섹션 */}
      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        {user ? (
          <div className="space-y-1">
            <Link
              href={`/profile/${username}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415] transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-[#EBF2FF] text-[#3478FF] flex items-center justify-center text-xs font-bold">
                {(username ?? "?")[0].toUpperCase()}
              </span>
              <span className="font-medium truncate">{username}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415] transition-colors"
            >
              <span className="text-base">↩</span>
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center justify-center w-full py-2.5 rounded-xl bg-[#3478FF] hover:bg-[#1A5FD4] text-white text-sm font-medium transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: layout.tsx에 사이드바 여백 추가**

`src/app/layout.tsx`의 `<div className="flex min-h-screen">` 안에서 Sidebar가 fixed이므로, 메인 콘텐츠에 왼쪽 여백 추가:

`<main className="flex-1 min-w-0 pb-16 md:pb-0">` 를 아래로 교체:

```tsx
<main className="flex-1 min-w-0 pb-16 md:pb-0 md:ml-60">
  {children}
</main>
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/Sidebar.tsx src/app/layout.tsx
git commit -m "feat: 좌측 사이드바 컴포넌트 추가"
```

---

## Task 3: BottomNav 컴포넌트 (모바일)

**Files:**
- Create: `src/components/BottomNav.tsx`

- [ ] **Step 1: BottomNav.tsx 생성**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function TabItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
        active ? "text-[#3478FF]" : "text-[#9CA3AF]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 py-1">
      <TabItem href="/gallery" label="갤러리" icon="🖼" />
      <TabItem href="/community" label="커뮤니티" icon="💬" />
      <TabItem href="/figure-drawing" label="인체도형화" icon="✏️" />
      <TabItem href="/auth/login" label="로그인" icon="👤" />
    </nav>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: 모바일 하단 탭바 추가"
```

---

## Task 4: 갤러리 피드 페이지 리디자인

**Files:**
- Modify: `src/app/gallery/page.tsx`

- [ ] **Step 1: gallery/page.tsx 전체 교체**

```tsx
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/gallery/page.tsx
git commit -m "feat: 갤러리 피드 라이트 테마 리디자인 (2열 그리드)"
```

---

## Task 5: 갤러리 업로드 페이지 리디자인

**Files:**
- Modify: `src/app/gallery/upload/page.tsx`

- [ ] **Step 1: gallery/upload/page.tsx 전체 교체**

```tsx
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/gallery/upload/page.tsx
git commit -m "feat: 갤러리 업로드 라이트 테마 + 2단 레이아웃"
```

---

## Task 6: 커뮤니티 목록 + 글쓰기 + 상세 페이지 리디자인

**Files:**
- Modify: `src/app/community/page.tsx`
- Modify: `src/app/community/new/page.tsx`
- Modify: `src/app/community/[id]/page.tsx`

- [ ] **Step 1: community/page.tsx 전체 교체**

```tsx
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#141415]">커뮤니티</h1>
        <Link
          href="/community/new"
          className="text-sm bg-[#3478FF] hover:bg-[#1A5FD4] text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          글쓰기
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-[#E5E7EB]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#6B7280] text-sm mb-4">아직 게시글이 없습니다.</p>
          <Link href="/community/new" className="text-[#3478FF] hover:text-[#1A5FD4] text-sm font-medium">
            첫 글을 남겨보세요 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block bg-white rounded-xl px-5 py-4 border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-[#141415] font-medium text-sm mb-2 line-clamp-1">{post.title}</h2>
              <div className="flex items-center gap-3 text-[#9CA3AF] text-xs">
                <span className="text-[#6B7280]">{post.username}</span>
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
```

- [ ] **Step 2: community/new/page.tsx 전체 교체**

```tsx
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
```

- [ ] **Step 3: community/[id]/page.tsx 전체 교체**

```tsx
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
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id ?? null));

    async function fetchData() {
      const [{ data: postData }, { data: commentData }] = await Promise.all([
        supabase.from("community_posts").select("*, profiles(username)").eq("id", id).single(),
        supabase.from("comments").select("*, profiles(username)").eq("post_id", id).eq("post_type", "community").order("created_at", { ascending: true }),
      ]);
      setPost(postData as unknown as Post);
      setComments((commentData as unknown as Comment[]) ?? []);
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
      .insert({ user_id: currentUser, post_id: id, post_type: "community", content: commentText })
      .select("*").single();

    if (!error && inserted) {
      const { data: withProfile } = await supabase
        .from("comments").select("*, profiles(username)").eq("id", inserted.id).single();
      if (withProfile) setComments((prev) => [...prev, withProfile as unknown as Comment]);
      setCommentText("");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8 text-[#6B7280]">불러오는 중...</div>;
  if (!post) return <div className="max-w-3xl mx-auto px-4 py-8 text-[#6B7280]">게시글을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/community" className="text-[#6B7280] hover:text-[#3478FF] text-sm mb-6 inline-block transition-colors">
        ← 목록으로
      </Link>

      <div className="bg-white rounded-xl p-6 border border-[#E5E7EB] shadow-sm mb-4">
        <h1 className="text-[#141415] text-xl font-bold mb-3">{post.title}</h1>
        <div className="flex items-center gap-3 text-[#9CA3AF] text-sm mb-6 pb-4 border-b border-[#E5E7EB]">
          <Link href={`/profile/${post.profiles?.username}`} className="text-[#6B7280] hover:text-[#3478FF] transition-colors">
            {post.profiles?.username}
          </Link>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        <p className="text-[#141415] text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-[#E5E7EB] shadow-sm">
        <h2 className="text-[#141415] font-semibold mb-4">댓글 {comments.length}</h2>
        <div className="space-y-3 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-[#F8F9FA] rounded-xl px-4 py-3 border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[#141415] text-sm font-medium">{comment.profiles?.username}</span>
                <span className="text-[#9CA3AF] text-xs">
                  {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-[#6B7280] text-sm whitespace-pre-wrap">{comment.content}</p>
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
              className="flex-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="self-end bg-[#3478FF] hover:bg-[#1A5FD4] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {submitting ? "..." : "등록"}
            </button>
          </form>
        ) : (
          <p className="text-center text-[#9CA3AF] text-sm py-4">
            <Link href="/auth/login" className="text-[#3478FF] hover:text-[#1A5FD4]">로그인</Link>
            {" "}후 댓글을 남길 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/community/page.tsx "src/app/community/new/page.tsx" "src/app/community/[id]/page.tsx"
git commit -m "feat: 커뮤니티 페이지 라이트 테마 리디자인"
```

---

## Task 7: 로그인 + 회원가입 페이지 리디자인

**Files:**
- Modify: `src/app/auth/login/page.tsx`
- Modify: `src/app/auth/signup/page.tsx`

- [ ] **Step 1: auth/login/page.tsx 전체 교체**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("이메일 또는 비밀번호가 올바르지 않습니다."); setLoading(false); }
    else { router.push("/"); router.refresh(); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FA]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#141415]">로그인</h1>
          <p className="text-[#6B7280] text-sm mt-2">Dream에 오신 것을 환영합니다</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
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
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#9CA3AF]">
            계정이 없으신가요?{" "}
            <Link href="/auth/signup" className="text-[#3478FF] hover:text-[#1A5FD4] font-medium">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: auth/signup/page.tsx 전체 교체**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/login` },
    });
    if (error) { setError(error.message); setLoading(false); }
    else setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FA]">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-xl font-bold text-[#141415] mb-2">이메일을 확인해주세요</h1>
          <p className="text-[#6B7280] text-sm mb-1">
            <span className="text-[#141415] font-medium">{email}</span>로 인증 메일을 보냈습니다.
          </p>
          <p className="text-[#9CA3AF] text-sm mb-6">메일의 링크를 클릭하면 가입이 완료됩니다.</p>
          <Link href="/auth/login" className="text-[#3478FF] hover:text-[#1A5FD4] text-sm font-medium">
            로그인 페이지로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FA]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#141415]">회원가입</h1>
          <p className="text-[#6B7280] text-sm mt-2">Dream 계정을 만들어보세요</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#141415] mb-1.5">비밀번호 (6자 이상)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[#141415] text-sm focus:outline-none focus:border-[#3478FF] transition-colors"
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
              {loading ? "가입 중..." : "가입하기"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#9CA3AF]">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="text-[#3478FF] hover:text-[#1A5FD4] font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/auth/login/page.tsx src/app/auth/signup/page.tsx
git commit -m "feat: 로그인/회원가입 라이트 카드 폼 리디자인"
```

---

## Task 8: 프로필 페이지 리디자인

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: profile/[username]/page.tsx 전체 교체**

```tsx
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
```

- [ ] **Step 2: 커밋**

```bash
git add "src/app/profile/[username]/page.tsx"
git commit -m "feat: 프로필 페이지 라이트 테마 리디자인"
```

---

## Task 9: 빌드 검증 + 배포

- [ ] **Step 1: 기존 Navbar 컴포넌트 삭제**

```bash
rm src/components/Navbar.tsx
```

- [ ] **Step 2: 프로덕션 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공. 모든 페이지 정상 빌드.

- [ ] **Step 3: 배포**

```bash
git push origin main
```

Expected: Vercel 자동 배포.

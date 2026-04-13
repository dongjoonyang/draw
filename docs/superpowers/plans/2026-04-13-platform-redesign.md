# Dream 플랫폼 재구축 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 인체도형화 단독 툴을 Supabase 기반 다목적 아트 플랫폼으로 확장한다. 로그인/회원가입, 상단 카테고리 네비게이션, 갤러리(이미지 업로드), 커뮤니티(텍스트 게시판)를 추가한다.

**Architecture:** Next.js 14 App Router + Supabase (Auth + PostgreSQL + Storage). 클라이언트 컴포넌트는 `@supabase/ssr`의 브라우저 클라이언트를 사용하고, 서버 컴포넌트/미들웨어는 서버 클라이언트를 사용한다. 인체도형화는 `/figure-drawing`으로 이동, 메인 `/`는 갤러리 피드가 된다.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase JS v2 (`@supabase/supabase-js`, `@supabase/ssr`), Vercel

---

## 사전 준비 (수동)

아래 단계는 코드 작업 전 직접 완료해야 한다.

- [ ] **supabase.com 에서 새 프로젝트 생성**
- [ ] **Project Settings → API 에서 값 복사**
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **프로젝트 루트에 `.env.local` 파일 생성**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## 파일 구조

```
신규 생성:
  supabase/migrations/001_initial_schema.sql
  src/types/database.ts
  src/lib/supabase.ts
  src/lib/supabase-server.ts
  src/components/Navbar.tsx
  src/app/figure-drawing/page.tsx        ← 현재 src/app/page.tsx 내용 이동
  src/app/auth/login/page.tsx
  src/app/auth/signup/page.tsx
  src/app/gallery/page.tsx
  src/app/gallery/upload/page.tsx
  src/app/community/page.tsx
  src/app/community/new/page.tsx
  src/app/community/[id]/page.tsx
  src/app/profile/[username]/page.tsx

수정:
  src/app/page.tsx                        ← 갤러리 피드로 교체
  src/app/layout.tsx                      ← Navbar 추가, pt-14 추가
  .gitignore                              ← .env.local, .superpowers/ 추가
```

---

## Task 1: 패키지 설치 + Supabase 클라이언트 설정

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/supabase-server.ts`
- Create: `src/types/database.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 패키지 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected: `package.json`의 dependencies에 두 패키지 추가됨.

- [ ] **Step 2: `.gitignore`에 항목 추가**

`src/app/.gitignore` 또는 루트 `.gitignore`를 열어 아래 내용 추가:

```
.env.local
.superpowers/
```

- [ ] **Step 3: DB 타입 파일 생성**

```typescript
// src/types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          avatar_url?: string | null
          bio?: string | null
        }
      }
      gallery_posts: {
        Row: {
          id: string
          user_id: string
          image_url: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
        }
      }
      community_posts: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          created_at?: string
        }
        Update: {
          title?: string
          content?: string
        }
      }
      likes: {
        Row: {
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
        }
        Insert: {
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
        }
        Update: never
      }
      comments: {
        Row: {
          id: string
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          post_type: 'gallery' | 'community'
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
      }
    }
    Views: {
      gallery_feed: {
        Row: {
          id: string
          user_id: string
          image_url: string
          title: string
          description: string | null
          created_at: string
          username: string
          likes_count: number
          comments_count: number
        }
      }
      community_feed: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          created_at: string
          username: string
          comments_count: number
        }
      }
    }
  }
}
```

- [ ] **Step 4: 브라우저 클라이언트 생성**

```typescript
// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: 서버 클라이언트 생성**

```typescript
// src/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 6: 빌드 에러 없는지 확인**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공. `.env.local` 없으면 `NEXT_PUBLIC_SUPABASE_URL` 관련 경고가 나올 수 있으나 빌드는 통과.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/supabase.ts src/lib/supabase-server.ts src/types/database.ts .gitignore package.json package-lock.json
git commit -m "feat: Supabase 클라이언트 설정 및 DB 타입 정의 추가"
```

---

## Task 2: DB 스키마 + Supabase Storage 설정

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: SQL 스키마 작성**

```sql
-- supabase/migrations/001_initial_schema.sql

-- profiles
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now()
);

-- gallery_posts
create table public.gallery_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  image_url   text not null,
  title       text not null,
  description text,
  created_at  timestamptz default now()
);

-- community_posts
create table public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  title       text not null,
  content     text not null,
  created_at  timestamptz default now()
);

-- likes
create table public.likes (
  user_id     uuid references public.profiles(id) on delete cascade,
  post_id     uuid not null,
  post_type   text check (post_type in ('gallery', 'community')),
  primary key (user_id, post_id, post_type)
);

-- comments
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  post_id     uuid not null,
  post_type   text check (post_type in ('gallery', 'community')),
  content     text not null,
  created_at  timestamptz default now()
);

-- RLS 활성화
alter table public.profiles enable row level security;
alter table public.gallery_posts enable row level security;
alter table public.community_posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- profiles RLS
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- gallery_posts RLS
create policy "gallery_select" on public.gallery_posts for select using (true);
create policy "gallery_insert" on public.gallery_posts for insert with check (auth.uid() = user_id);
create policy "gallery_delete" on public.gallery_posts for delete using (auth.uid() = user_id);

-- community_posts RLS
create policy "community_select" on public.community_posts for select using (true);
create policy "community_insert" on public.community_posts for insert with check (auth.uid() = user_id);
create policy "community_delete" on public.community_posts for delete using (auth.uid() = user_id);

-- likes RLS
create policy "likes_select" on public.likes for select using (true);
create policy "likes_insert" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on public.likes for delete using (auth.uid() = user_id);

-- comments RLS
create policy "comments_select" on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id);

-- 회원가입 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 갤러리 피드 뷰 (카운트 포함)
create view public.gallery_feed as
select
  gp.id,
  gp.user_id,
  gp.image_url,
  gp.title,
  gp.description,
  gp.created_at,
  p.username,
  count(distinct l.user_id) as likes_count,
  count(distinct c.id) as comments_count
from public.gallery_posts gp
left join public.profiles p on p.id = gp.user_id
left join public.likes l on l.post_id = gp.id and l.post_type = 'gallery'
left join public.comments c on c.post_id = gp.id and c.post_type = 'gallery'
group by gp.id, p.username;

-- 커뮤니티 피드 뷰 (댓글 수 포함)
create view public.community_feed as
select
  cp.id,
  cp.user_id,
  cp.title,
  cp.content,
  cp.created_at,
  p.username,
  count(distinct c.id) as comments_count
from public.community_posts cp
left join public.profiles p on p.id = cp.user_id
left join public.comments c on c.post_id = cp.id and c.post_type = 'community'
group by cp.id, p.username;
```

- [ ] **Step 3: Supabase 대시보드에서 SQL 실행**

  1. supabase.com → 프로젝트 → **SQL Editor** 열기
  2. 위 SQL 전체 붙여넣고 **Run** 클릭
  3. Table Editor에서 `profiles`, `gallery_posts`, `community_posts`, `likes`, `comments` 테이블 생성 확인

- [ ] **Step 4: Storage 버킷 생성**

  1. Supabase 대시보드 → **Storage** → **New bucket**
  2. Bucket name: `gallery-images`
  3. Public bucket: **체크** (공개 이미지)
  4. Save

- [ ] **Step 5: Storage RLS 정책 추가** (SQL Editor에서 실행)

```sql
-- 갤러리 이미지 업로드: 로그인 유저만 가능
create policy "gallery_images_insert"
  on storage.objects for insert
  with check (bucket_id = 'gallery-images' and auth.role() = 'authenticated');

-- 갤러리 이미지 읽기: 누구나 가능
create policy "gallery_images_select"
  on storage.objects for select
  using (bucket_id = 'gallery-images');
```

- [ ] **Step 6: 커밋**

```bash
git add supabase/
git commit -m "feat: Supabase DB 스키마 및 Storage 설정 추가"
```

---

## Task 3: 상단 네비게이션 + 레이아웃 업데이트

**Files:**
- Create: `src/components/Navbar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Navbar 컴포넌트 생성**

```tsx
// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        pathname === href || pathname.startsWith(href + "/")
          ? "text-white font-medium"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 h-14 flex items-center gap-6">
      <Link href="/" className="text-indigo-400 font-bold text-base mr-2">
        Dream
      </Link>
      {navLink("/figure-drawing", "인체도형화")}
      {navLink("/gallery", "갤러리")}
      {navLink("/community", "커뮤니티")}

      <div className="ml-auto relative" ref={menuRef}>
        {user ? (
          <>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-sm text-gray-300 hover:text-white flex items-center gap-1"
            >
              {user.email?.split("@")[0]}
              <span className="text-xs text-gray-500">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-lg py-1 w-44 shadow-xl">
                <Link
                  href={`/profile/${user.email?.split("@")[0]}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  내 프로필
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  대시보드
                </Link>
                <hr className="border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  로그아웃
                </button>
              </div>
            )}
          </>
        ) : (
          <Link
            href="/auth/login"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: layout.tsx 업데이트**

`src/app/layout.tsx`의 전체 내용을 아래로 교체:

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Navbar from "@/components/Navbar";

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
      <body className="antialiased min-h-screen bg-gray-950 text-white">
        <Navbar />
        <main className="pt-14">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 로컬 서버에서 네비게이션 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 열어서 확인:
- 상단에 `Dream | 인체도형화 | 갤러리 | 커뮤니티 | 로그인` 네비게이션 표시됨
- 기존 페이지 내용 깨지지 않음

- [ ] **Step 4: 커밋**

```bash
git add src/components/Navbar.tsx src/app/layout.tsx
git commit -m "feat: 상단 네비게이션 바 추가 및 레이아웃 업데이트"
```

---

## Task 4: 로그인 페이지

**Files:**
- Create: `src/app/auth/login/page.tsx`

- [ ] **Step 1: 로그인 페이지 생성**

```tsx
// src/app/auth/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-8 text-center">로그인</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          계정이 없으신가요?{" "}
          <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 로컬에서 로그인 페이지 확인**

`http://localhost:3000/auth/login` 접속 → 이메일/비밀번호 폼 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/auth/login/page.tsx
git commit -m "feat: 로그인 페이지 추가"
```

---

## Task 5: 회원가입 페이지

**Files:**
- Create: `src/app/auth/signup/page.tsx`

- [ ] **Step 1: 회원가입 페이지 생성**

```tsx
// src/app/auth/signup/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/login`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-white mb-3">이메일을 확인해주세요</h1>
          <p className="text-gray-400 text-sm mb-2">
            <span className="text-white">{email}</span>로 인증 메일을 보냈습니다.
          </p>
          <p className="text-gray-500 text-sm">메일의 링크를 클릭하면 가입이 완료됩니다.</p>
          <Link
            href="/auth/login"
            className="mt-8 inline-block text-indigo-400 hover:text-indigo-300 text-sm"
          >
            로그인 페이지로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-8 text-center">회원가입</h1>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">비밀번호 (6자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 로컬에서 회원가입 플로우 확인**

`http://localhost:3000/auth/signup` → 폼 작성 → 제출 → "이메일 확인" 화면 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/auth/signup/page.tsx
git commit -m "feat: 회원가입 페이지 추가"
```

---

## Task 6: 인체도형화 페이지 이동

**Files:**
- Create: `src/app/figure-drawing/page.tsx` ← `src/app/page.tsx` 내용 그대로 이동
- Modify: `src/app/page.tsx` ← 갤러리 피드로 교체

- [ ] **Step 1: figure-drawing 디렉토리 생성**

```bash
mkdir -p src/app/figure-drawing
```

- [ ] **Step 2: page.tsx 내용을 figure-drawing/page.tsx로 복사**

`src/app/page.tsx` 파일을 전체 읽어서 `src/app/figure-drawing/page.tsx`로 동일하게 생성. 내용 변경 없음.

- [ ] **Step 3: `src/app/page.tsx`를 갤러리 피드로 교체**

`src/app/page.tsx` 전체를 아래로 교체:

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/gallery");
}
```

- [ ] **Step 4: 로컬에서 확인**

- `http://localhost:3000` → `/gallery`로 리디렉션 됨 (갤러리는 다음 Task에서 생성)
- `http://localhost:3000/figure-drawing` → 기존 인체도형화 툴 정상 동작 확인
- 상단 "인체도형화" 링크 클릭 → 기존 기능 그대로 동작 확인

- [ ] **Step 5: 커밋**

```bash
git add src/app/figure-drawing/page.tsx src/app/page.tsx
git commit -m "feat: 인체도형화 /figure-drawing으로 이동, 메인은 갤러리로 리디렉션"
```

---

## Task 7: 갤러리 피드 페이지

**Files:**
- Create: `src/app/gallery/page.tsx`

- [ ] **Step 1: 갤러리 피드 페이지 생성**

```tsx
// src/app/gallery/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type FeedPost = Database["public"]["Views"]["gallery_feed"]["Row"];

export default function GalleryPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from("gallery_feed")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) setPosts(data ?? []);
      setLoading(false);
    }
    fetchPosts();
  }, []);

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
                  <span>❤ {post.likes_count}</span>
                  <span>💬 {post.comments_count}</span>
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
```

- [ ] **Step 2: 갤러리 피드에 좋아요 버튼 추가** — Step 1의 `src/app/gallery/page.tsx`를 아래 전체 내용으로 교체

```tsx
// src/app/gallery/page.tsx
"use client";

import { useEffect, useState } from "react";
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
  const supabase = createClient();

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
          .select("post_id")
          .eq("user_id", uid)
          .eq("post_type", "gallery");
        setUserLikes(new Set(likesData?.map((l) => l.post_id) ?? []));
      }

      setLoading(false);
    }
    init();
  }, []);

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
        prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count - 1 } : p)
      );
    } else {
      await supabase
        .from("likes")
        .insert({ user_id: currentUserId, post_id: postId, post_type: "gallery" });
      setUserLikes((prev) => new Set(prev).add(postId));
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)
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
                    className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                      userLikes.has(post.id) ? "text-red-400" : "hover:text-red-400"
                    }`}
                  >
                    {userLikes.has(post.id) ? "❤" : "🤍"} {post.likes_count}
                  </button>
                  <span>💬 {post.comments_count}</span>
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
```

- [ ] **Step 3: 로컬에서 갤러리 피드 확인**

`http://localhost:3000/gallery` → 빈 상태("아직 작품이 없습니다.") 표시 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/gallery/page.tsx
git commit -m "feat: 갤러리 피드 페이지 + 좋아요 버튼 추가"
```

---

## Task 8: 갤러리 업로드 페이지

**Files:**
- Create: `src/app/gallery/upload/page.tsx`

- [ ] **Step 1: 업로드 페이지 생성**

```tsx
// src/app/gallery/upload/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setAuthChecked(true);
    });
  }, []);

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

    // 1. Supabase Storage에 이미지 업로드
    const ext = file.name.split(".").pop();
    const fileName = `${userData.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("gallery-images")
      .upload(fileName, file);

    if (uploadError) {
      setError("이미지 업로드 실패: " + uploadError.message);
      setLoading(false);
      return;
    }

    // 2. public URL 가져오기
    const { data: urlData } = supabase.storage
      .from("gallery-images")
      .getPublicUrl(fileName);

    // 3. gallery_posts에 저장
    const { error: insertError } = await supabase.from("gallery_posts").insert({
      user_id: userData.user.id,
      image_url: urlData.publicUrl,
      title,
      description: description || null,
    });

    if (insertError) {
      setError("저장 실패: " + insertError.message);
      setLoading(false);
      return;
    }

    router.push("/gallery");
    router.refresh();
  };

  if (!authChecked) return null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-white mb-8">작품 올리기</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 이미지 업로드 영역 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">이미지</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl cursor-pointer transition-colors overflow-hidden"
          >
            {preview ? (
              <img src={preview} alt="preview" className="w-full max-h-80 object-contain bg-gray-900" />
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-500">
                <span className="text-3xl mb-2">🖼</span>
                <span className="text-sm">클릭하여 이미지 선택</span>
                <span className="text-xs mt-1 text-gray-600">JPG, PNG, WebP 지원</span>
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

        {/* 제목 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="작품 제목"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="작품에 대한 설명을 남겨주세요"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {loading ? "업로드 중..." : "올리기"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 로컬에서 업로드 플로우 확인**

  1. 로그인하지 않고 `http://localhost:3000/gallery/upload` 접속 → `/auth/login`으로 리디렉션 확인
  2. 로그인 후 접속 → 업로드 폼 표시 확인
  3. 이미지 선택 → 미리보기 표시 확인

- [ ] **Step 3: 커밋**

```bash
git add src/app/gallery/upload/page.tsx
git commit -m "feat: 갤러리 업로드 페이지 추가"
```

---

## Task 9: 커뮤니티 게시판

**Files:**
- Create: `src/app/community/page.tsx`

- [ ] **Step 1: 커뮤니티 목록 페이지 생성**

```tsx
// src/app/community/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type FeedPost = Database["public"]["Views"]["community_feed"]["Row"];

export default function CommunityPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
  }, []);

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
                <span>💬 {post.comments_count}</span>
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

- [ ] **Step 2: 로컬에서 커뮤니티 페이지 확인**

`http://localhost:3000/community` → 빈 상태 화면 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/community/page.tsx
git commit -m "feat: 커뮤니티 게시판 목록 페이지 추가"
```

---

## Task 10: 커뮤니티 글쓰기 + 상세 페이지

**Files:**
- Create: `src/app/community/new/page.tsx`
- Create: `src/app/community/[id]/page.tsx`

- [ ] **Step 1: 글쓰기 페이지 생성**

```tsx
// src/app/community/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function CommunityNewPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setAuthChecked(true);
    });
  }, []);

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

    if (error) {
      setError("게시글 저장 실패: " + error.message);
      setLoading(false);
    } else {
      router.push("/community");
      router.refresh();
    }
  };

  if (!authChecked) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-white mb-8">글쓰기</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="제목을 입력하세요"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">내용 *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={10}
            placeholder="내용을 입력하세요"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 text-sm transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 게시글 상세 페이지 생성**

```tsx
// src/app/community/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
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
  const supabase = createClient();

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

      setPost(postData as Post);
      setComments((commentData as Comment[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { router.push("/auth/login"); return; }
    setSubmitting(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: currentUser,
        post_id: id,
        post_type: "community",
        content: commentText,
      })
      .select("*, profiles(username)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as Comment]);
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

      {/* 게시글 */}
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

      {/* 댓글 */}
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

        {/* 댓글 입력 */}
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
```

- [ ] **Step 3: 로컬에서 커뮤니티 플로우 확인**

  1. `http://localhost:3000/community/new` → 로그인 전: 로그인 페이지로 리디렉션
  2. 로그인 후 글쓰기 → 제출 → `/community`로 이동 확인
  3. 게시글 클릭 → 상세 페이지 표시 확인
  4. 댓글 입력 → 실시간 댓글 추가 확인

- [ ] **Step 4: 커밋**

```bash
git add "src/app/community/new/page.tsx" "src/app/community/[id]/page.tsx"
git commit -m "feat: 커뮤니티 글쓰기 및 게시글 상세 페이지 추가"
```

---

## Task 11: 프로필 페이지

**Files:**
- Create: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: 프로필 페이지 생성**

```tsx
// src/app/profile/[username]/page.tsx
"use client";

import { useEffect, useState } from "react";
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
  const supabase = createClient();

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
  }, [username]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">불러오는 중...</div>;
  if (!profile) return <div className="max-w-2xl mx-auto px-4 py-8 text-gray-500">유저를 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
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

      {/* 갤러리 작품 목록 */}
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
```

- [ ] **Step 2: 로컬에서 프로필 페이지 확인**

  1. 갤러리에서 작가명 클릭 → `/profile/[username]` 이동 확인
  2. 프로필 정보 및 업로드한 작품 목록 표시 확인

- [ ] **Step 3: 커밋**

```bash
git add src/app/profile/
git commit -m "feat: 유저 프로필 페이지 추가"
```

---

## Task 12: 전체 빌드 검증 + Vercel 배포

- [ ] **Step 1: `.env.local` 환경변수 확인**

`.env.local`에 아래 두 값이 있는지 확인:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

- [ ] **Step 2: 프로덕션 빌드 테스트**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공. 각 페이지 빌드 결과 표시.

- [ ] **Step 3: Vercel 환경변수 등록**

  1. vercel.com → 프로젝트 → **Settings → Environment Variables**
  2. `NEXT_PUBLIC_SUPABASE_URL` 추가
  3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가

- [ ] **Step 4: Vercel 배포**

```bash
git push origin main
```

Expected: Vercel이 자동 배포 시작. 배포 완료 후 프로덕션 URL에서 전체 플로우 확인.

- [ ] **Step 5: 전체 기능 수동 확인 체크리스트**

  - [ ] 회원가입 → 이메일 인증 → 로그인 동작
  - [ ] 네비게이션 링크 모두 동작 (인체도형화/갤러리/커뮤니티)
  - [ ] 갤러리: 이미지 업로드 → 피드에 표시
  - [ ] 커뮤니티: 글쓰기 → 목록에 표시 → 상세 → 댓글
  - [ ] 프로필 페이지: 작가명 클릭 시 작품 목록 표시
  - [ ] 로그아웃 → 로그인 전 상태로 전환
  - [ ] 인체도형화 `/figure-drawing` 기존 기능 정상 동작

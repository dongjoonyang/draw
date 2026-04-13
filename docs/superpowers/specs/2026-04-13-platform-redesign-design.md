# Dream 플랫폼 재구축 설계 문서

**날짜:** 2026-04-13  
**범위:** 로그인/회원가입, 상단 카테고리 네비게이션, 갤러리, 커뮤니티  

---

## 1. 개요

현재 인체도형화 단독 툴에서 **다목적 아트 플랫폼**으로 확장한다. 인체도형화는 하나의 카테고리로 편입되고, 그림 업로드 갤러리와 텍스트 커뮤니티가 추가된다.

---

## 2. 기술 스택

| 구성 요소 | 기술 |
|-----------|------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Auth | Supabase Auth (이메일 + 비밀번호) |
| Database | Supabase PostgreSQL |
| 이미지 저장 | Supabase Storage |
| 배포 | Vercel |

---

## 3. 데이터베이스 스키마

```sql
-- 유저 프로필 (Supabase Auth users 테이블과 1:1)
profiles (
  id          uuid references auth.users primary key,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now()
)

-- 갤러리 작품
gallery_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  image_url   text not null,
  title       text not null,
  description text,
  created_at  timestamptz default now()
)

-- 커뮤니티 게시글
community_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  content     text not null,
  created_at  timestamptz default now()
)

-- 좋아요 (갤러리/커뮤니티 공용)
likes (
  user_id     uuid references profiles(id) on delete cascade,
  post_id     uuid not null,
  post_type   text check (post_type in ('gallery', 'community')),
  primary key (user_id, post_id, post_type)
)

-- 댓글 (갤러리/커뮤니티 공용)
comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  post_id     uuid not null,
  post_type   text check (post_type in ('gallery', 'community')),
  content     text not null,
  created_at  timestamptz default now()
)
```

---

## 4. 페이지 구조

```
/                    → 메인 (갤러리 피드)
/figure-drawing      → 인체도형화 (현재 page.tsx 이동)
/auth/login          → 로그인
/auth/signup         → 회원가입
/gallery             → 갤러리 피드
/gallery/upload      → 작품 올리기 (로그인 필요)
/community           → 커뮤니티 게시판
/community/new       → 글쓰기 (로그인 필요)
/community/[id]      → 게시글 상세 + 댓글
/profile/[username]  → 유저 프로필
/dashboard           → 연습 기록 대시보드 (현재 유지)
```

---

## 5. 네비게이션

상단 고정 네비게이션 바:

```
[Dream 로고]  인체도형화  갤러리  커뮤니티          [로그인] or [프로필 아바타]
```

- 로그인 전: `[로그인]` 버튼
- 로그인 후: 프로필 아바타 클릭 → 드롭다운 (내 프로필 / 대시보드 / 로그아웃)

---

## 6. 핵심 기능 상세

### 6-1. 로그인 / 회원가입
- Supabase Auth 이메일 + 비밀번호
- 가입 시 이메일 인증 발송
- 가입 완료 시 `profiles` 테이블에 자동 row 생성 (Supabase trigger)
- 세션 관리: Supabase 클라이언트 세션 (localStorage 기반 Supabase 내장)

### 6-2. 갤러리
- 피드: 최신순, 피드 리스트 스타일 (이미지 썸네일 + 제목 + 작가명 + 좋아요/댓글 수)
- 업로드 폼: 이미지 파일 선택 + 제목(필수) + 설명(선택) → Supabase Storage 업로드
- 좋아요/댓글: 로그인한 유저만 가능, 비로그인 시 로그인 유도

### 6-3. 커뮤니티
- 게시판: 최신순 텍스트 글 목록 (제목 + 작성자 + 날짜 + 댓글 수)
- 글쓰기: 제목 + 본문 (심플 textarea, 마크다운 없음)
- 게시글 상세: 본문 + 댓글 목록 + 댓글 입력창

### 6-4. 인체도형화 편입
- 현재 `src/app/page.tsx` → `src/app/figure-drawing/page.tsx`로 이동
- 기능 변경 없음
- 로그인 시 연습 기록을 Supabase DB에도 저장 (localStorage 병행 유지)

### 6-5. 프로필 페이지
- 유저명, 아바타, 소개글
- 해당 유저가 올린 갤러리 작품 목록

---

## 7. 구현 단계

| 단계 | 내용 |
|------|------|
| 1단계 | Supabase 프로젝트 설정, DB 스키마 생성, 환경변수 설정 |
| 2단계 | 상단 네비게이션 + 레이아웃 개편 |
| 3단계 | 로그인 / 회원가입 페이지 |
| 4단계 | 갤러리 피드 + 업로드 |
| 5단계 | 커뮤니티 게시판 + 글쓰기 + 댓글 |
| 6단계 | 인체도형화 경로 이동 + 네비게이션 연결 |
| 7단계 | 프로필 페이지 |

---

## 8. 범위 외 (미구현)

- 팔로우/팔로워 기능
- 알림 시스템
- 검색/필터
- 소셜 로그인 (Google 등)
- 태그 시스템

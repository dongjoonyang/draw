# Dream UI 리디자인 설계

**목표:** 현재 다크 테마를 Postype 스타일의 라이트 테마로 전환. 상단 Navbar를 제거하고 좌측 사이드바 네비게이션으로 교체. 전체 색상/카드 스타일 리프레시.

---

## 1. 레이아웃 구조

### 데스크탑
```
+------------------+----------------------------------+
|   Sidebar 240px  |        Main Content              |
|                  |                                  |
|  [Dream 로고]    |   (각 페이지 콘텐츠)             |
|                  |                                  |
|  갤러리          |                                  |
|  커뮤니티        |                                  |
|  인체도형화      |                                  |
|                  |                                  |
|  [프로필/로그인] |                                  |
+------------------+----------------------------------+
```

### 모바일
- 사이드바 숨김
- 하단 탭 바 (갤러리 / 커뮤니티 / 인체도형화 / 프로필)

---

## 2. 색상 시스템

| 역할 | 값 |
|------|----|
| 페이지 배경 | `#F8F9FA` |
| 사이드바/카드 배경 | `#FFFFFF` |
| 포인트 (primary) | `#3478FF` |
| 포인트 hover | `#1A5FD4` |
| 포인트 연한 배경 | `#EBF2FF` |
| 텍스트 primary | `#141415` |
| 텍스트 secondary | `#6B7280` |
| 사이드바 border | `#E5E7EB` |
| 카드 border | `#E5E7EB` |
| 카드 shadow | `0 1px 3px rgba(0,0,0,0.08)` |
| 활성 메뉴 배경 | `#EBF2FF` |
| 활성 메뉴 텍스트 | `#3478FF` |

---

## 3. 컴포넌트 스타일

### 사이드바
- 너비: 240px (고정)
- 배경: white
- 오른쪽 border: 1px solid #E5E7EB
- 로고: 상단 24px 패딩, "Dream" 텍스트 파란색 bold
- 메뉴 아이템: 12px 라운드, 패딩 10px 12px
- 활성: `#EBF2FF` 배경 + `#3478FF` 텍스트
- 비활성 hover: `#F3F4F6` 배경
- 하단 유저 섹션: border-top 구분선

### 카드
- 배경: white
- border: 1px solid #E5E7EB
- border-radius: 12px
- box-shadow: `0 1px 3px rgba(0,0,0,0.08)`
- hover: shadow 강화 `0 4px 12px rgba(0,0,0,0.12)`

### 버튼 (primary)
- 배경: `#3478FF`
- hover: `#1A5FD4`
- 텍스트: white
- border-radius: 8px
- 패딩: 8px 16px

### 입력 필드
- border: 1px solid #E5E7EB
- focus border: `#3478FF`
- 배경: white
- border-radius: 8px

---

## 4. 페이지별 레이아웃

### 갤러리 (`/gallery`)
- 2열 그리드 (데스크탑), 1열 (모바일)
- 카드: 상단 이미지 (aspect-ratio 4:3) + 하단 정보 영역
- 하단 정보: 제목(bold) + 작가명 + 좋아요/댓글 수
- 우상단 "작품 올리기" 파란 버튼

### 커뮤니티 (`/community`)
- 리스트형 카드 (풀 너비)
- 각 카드: 제목 + 작가 + 댓글수 + 날짜
- 우상단 "글쓰기" 파란 버튼

### 로그인/회원가입 (`/auth/*`)
- 화면 중앙 정렬
- 흰 카드 (max-width 400px) + 소프트 쉐도우
- 입력 필드 스타일 통일

### 갤러리 업로드 (`/gallery/upload`)
- 2단 레이아웃: 왼쪽 이미지 드롭존 / 오른쪽 폼
- 모바일: 상하 1열

### 프로필 (`/profile/[username]`)
- 상단 헤더 카드 (아바타 + 이름 + bio)
- 하단 2열 작품 그리드

---

## 5. 수정 파일 목록

### 삭제/교체
- `src/components/Navbar.tsx` → `src/components/Sidebar.tsx`로 교체

### 신규 생성
- `src/components/Sidebar.tsx` — 데스크탑 사이드바
- `src/components/BottomNav.tsx` — 모바일 하단 탭

### 수정
- `src/app/layout.tsx` — Navbar → Sidebar 레이아웃으로 교체
- `src/app/gallery/page.tsx` — 2열 그리드 카드 스타일
- `src/app/community/page.tsx` — 라이트 카드 스타일
- `src/app/community/[id]/page.tsx` — 라이트 스타일
- `src/app/community/new/page.tsx` — 라이트 폼 스타일
- `src/app/gallery/upload/page.tsx` — 2단 레이아웃
- `src/app/auth/login/page.tsx` — 흰 카드 폼
- `src/app/auth/signup/page.tsx` — 흰 카드 폼
- `src/app/profile/[username]/page.tsx` — 라이트 스타일
- `src/app/globals.css` — 배경색 변경

---

## 6. 제외 범위

- `/figure-drawing` — 기존 캔버스 툴, 레이아웃만 적용
- `/dashboard` — 변경 없음
- 기능 로직 변경 없음 (스타일만)

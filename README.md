# 인체 도형화 자가학습 플랫폼

> 평가가 아닌 성장의 기록 — 나만의 연습 공간

## 개요

타인의 시선이나 평가에 상처받지 않고, 자신의 연습 기록과 AI 가이드에만 집중할 수 있는 인체 드로잉 연습 플랫폼입니다.

## 기능

- **모델 탐색**: Unsplash Figure Drawing 컬렉션에서 인체 사진 로드
- **3분 연습 타이머**: 몰입 연습용 역카운트
- **AI 가이드**: MediaPipe Pose 기반 어깨·골반 중점 몸통 박스 오버레이
- **연습 기록**: LocalStorage에 자동 저장
- **대시보드**: amCharts로 주간 연습량 시각화

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사한 뒤 Unsplash API 키를 설정하세요.

```bash
cp .env.local.example .env.local
```

[Unsplash API](https://unsplash.com/oauth/applications)에서 앱을 등록하고 Access Key를 발급받으세요.

```env
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your_access_key
UNSPLASH_ACCESS_KEY=your_access_key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 기술 스택

- Next.js 14 (App Router)
- Tailwind CSS
- MediaPipe Pose
- amCharts 5
- Unsplash API

## 배포 (Vercel)

1. GitHub에 저장소 푸시
2. [Vercel](https://vercel.com)에서 프로젝트 import
3. 환경 변수 `UNSPLASH_ACCESS_KEY` 설정
4. Deploy
# draw
# draw

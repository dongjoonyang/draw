import { NextResponse } from "next/server";

// 서버 메모리 캐시 (page → 결과)
const cache = new Map<number, { data: unknown; cachedAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24시간

const QUERIES = [
  "fashion model full body photography",
  "ballet dancer full body",
  "fitness model full body",
  "street fashion full body",
  "gymnastics athlete full body",
  "martial arts fighter full body",
  "running athlete full body",
  "contemporary dance full body",
];

const PAGES_PER_QUERY = 15; // 쿼리당 15페이지 × 30장 = 450장

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);

  const accessKey =
    process.env.UNSPLASH_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return NextResponse.json(
      { error: "Unsplash API key not configured. .env.local에 UNSPLASH_ACCESS_KEY를 설정해주세요." },
      { status: 500 }
    );
  }

  const queryIndex = Math.floor((page - 1) / PAGES_PER_QUERY) % QUERIES.length;
  const subPage = ((page - 1) % PAGES_PER_QUERY) + 1;
  const query = QUERIES[queryIndex];

  // 캐시 확인
  const cached = cache.get(page);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${subPage}&per_page=30`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Unsplash API error: ${err}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const results = data.results ?? [];

    // 캐시 저장
    cache.set(page, { data: results, cachedAt: Date.now() });

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

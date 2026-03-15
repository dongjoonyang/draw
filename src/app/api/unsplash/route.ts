import { NextResponse } from "next/server";

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

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${subPage}&per_page=30&orientation=portrait`,
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
    return NextResponse.json(data.results ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

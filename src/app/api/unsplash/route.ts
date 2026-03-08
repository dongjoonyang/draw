import { NextResponse } from "next/server";

const FIGURE_DRAWING_COLLECTION_ID = "3612985"; // Poses for figure drawing

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "1";

  const accessKey =
    process.env.UNSPLASH_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return NextResponse.json(
      { error: "Unsplash API key not configured. .env.local에 UNSPLASH_ACCESS_KEY를 설정해주세요." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/collections/${FIGURE_DRAWING_COLLECTION_ID}/photos?page=${page}&per_page=20&orientation=portrait`,
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
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

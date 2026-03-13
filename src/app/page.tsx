"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PoseOverlay, { BoxKey } from "@/components/PoseOverlay";
import { getTodayRecord } from "@/lib/storage";

type GuideMode = "none" | "skeleton" | "box";
type BoxRenderMode = "off" | "wire" | "solid";

const BOX_DEFAULTS = {
  boxOpacity: 1,
  boxRenderMode: "wire" as BoxRenderMode,
  ribcageScale: 1.15,
  ribHeightScale: 1,
  waistScale: 1.0,
  waistHeightScale: 1,
  pelvisScale: 1.25,
  pelvisHeightScale: 1,
  boxThickness: 0.8,
  upperArmThickness: 1.4,
  lowerArmThickness: 1.4,
  thighThickness: 1.4,
  calfThickness: 1.4,
};

type UnsplashPhoto = {
  id: string;
  urls: { regular: string; full?: string };
  user: { name: string; username: string };
  alt_description?: string;
};

function SliderRow({
  label,
  value,
  min,
  max,
  step = 0.05,
  accent = "accent-violet-500",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  accent?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 flex justify-between text-[11px] text-ink/50">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full ${accent}`}
      />
    </div>
  );
}

export default function Home() {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [guideMode, setGuideMode] = useState<GuideMode>("none");

  const [boxOpacity, setBoxOpacity] = useState(BOX_DEFAULTS.boxOpacity);
  const [boxRenderMode, setBoxRenderMode] = useState<BoxRenderMode>(BOX_DEFAULTS.boxRenderMode);
  const [selectedBoxKey, setSelectedBoxKey] = useState<BoxKey | null>(null);
  const [ribcageScale, setRibcageScale] = useState(BOX_DEFAULTS.ribcageScale);
  const [ribHeightScale, setRibHeightScale] = useState(BOX_DEFAULTS.ribHeightScale);
  const [waistScale, setWaistScale] = useState(BOX_DEFAULTS.waistScale);
  const [waistHeightScale, setWaistHeightScale] = useState(BOX_DEFAULTS.waistHeightScale);
  const [pelvisScale, setPelvisScale] = useState(BOX_DEFAULTS.pelvisScale);
  const [pelvisHeightScale, setPelvisHeightScale] = useState(BOX_DEFAULTS.pelvisHeightScale);
  const [boxThickness, setBoxThickness] = useState(BOX_DEFAULTS.boxThickness);
  const [upperArmThickness, setUpperArmThickness] = useState(BOX_DEFAULTS.upperArmThickness);
  const [lowerArmThickness, setLowerArmThickness] = useState(BOX_DEFAULTS.lowerArmThickness);
  const [thighThickness, setThighThickness] = useState(BOX_DEFAULTS.thighThickness);
  const [calfThickness, setCalfThickness] = useState(BOX_DEFAULTS.calfThickness);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = Math.floor(Math.random() * 5) + 1;
      const res = await fetch(`/api/unsplash?page=${page}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPhotos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러올 수 없습니다.");
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    if (guideMode !== "box") setSelectedBoxKey(null);
  }, [guideMode]);

  const handleResetBox = () => {
    setBoxOpacity(BOX_DEFAULTS.boxOpacity);
    setBoxRenderMode(BOX_DEFAULTS.boxRenderMode);
    setRibcageScale(BOX_DEFAULTS.ribcageScale);
    setRibHeightScale(BOX_DEFAULTS.ribHeightScale);
    setWaistScale(BOX_DEFAULTS.waistScale);
    setWaistHeightScale(BOX_DEFAULTS.waistHeightScale);
    setPelvisScale(BOX_DEFAULTS.pelvisScale);
    setPelvisHeightScale(BOX_DEFAULTS.pelvisHeightScale);
    setBoxThickness(BOX_DEFAULTS.boxThickness);
    setUpperArmThickness(BOX_DEFAULTS.upperArmThickness);
    setLowerArmThickness(BOX_DEFAULTS.lowerArmThickness);
    setThighThickness(BOX_DEFAULTS.thighThickness);
    setCalfThickness(BOX_DEFAULTS.calfThickness);
  };

  const handleSelectPhoto = (photo: UnsplashPhoto) => {
    setSelectedPhoto(photo);
    setGuideMode("none");
  };

  const handleBack = () => {
    setSelectedPhoto(null);
    setGuideMode("none");
  };

  const todayRecord = getTodayRecord();

  const guideTabs: { key: GuideMode; label: string }[] = [
    { key: "none", label: "기본 사진" },
    { key: "skeleton", label: "스켈레톤" },
    { key: "box", label: "도형화" },
  ];

  /* ─────────────────────── EDITOR VIEW ─────────────────────────────────── */
  if (selectedPhoto) {
    return (
      <main className="flex h-screen flex-col overflow-hidden bg-paper">
        <header className="flex h-12 shrink-0 items-center border-b border-ink/[0.06] bg-paper px-4">
          <div className="flex w-52 shrink-0 items-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink/80"
            >
              <span className="text-base leading-none">←</span>
              <span>목록</span>
            </button>
          </div>

          <div className="flex flex-1 justify-center">
            <div className="flex items-center gap-0.5 rounded-lg bg-ink/10 p-0.5">
              {guideTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setGuideMode(key);
                    if (key === "box" && boxRenderMode === "off") setBoxRenderMode("wire");
                  }}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
                    guideMode === key
                      ? "bg-white text-accent shadow-sm"
                      : "text-ink/60 hover:text-ink hover:bg-ink/[0.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-52 shrink-0 items-center justify-end gap-2">
            <span className="text-[11px] text-ink/40">
              오늘 {todayRecord?.poseCount ?? 0}회
            </span>
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-xs text-ink/50 transition-colors hover:text-ink/80"
            >
              대시보드
            </Link>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink/[0.03]">
            <PoseOverlay
              imageSrc={selectedPhoto.urls.full ?? selectedPhoto.urls.regular}
              guideMode={guideMode}
              boxOpacity={boxOpacity}
              enable3DBox={true}
              boxRenderMode={boxRenderMode}
              ribcageScale={ribcageScale}
              ribHeightScale={ribHeightScale}
              waistScale={waistScale}
              waistHeightScale={waistHeightScale}
              pelvisScale={pelvisScale}
              pelvisHeightScale={pelvisHeightScale}
              boxThickness={boxThickness}
              upperArmThickness={upperArmThickness}
              lowerArmThickness={lowerArmThickness}
              thighThickness={thighThickness}
              calfThickness={calfThickness}
              onSelectedKeyChange={setSelectedBoxKey}
            />
          </section>

          <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-ink/[0.06] bg-paper">
            <div className="border-b border-ink/[0.06] p-5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-ink/30">
                사진
              </p>
              <p className="text-[10px] text-ink/30">
                © {selectedPhoto.user.name} / Unsplash
              </p>
            </div>

            {guideMode === "box" && (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/30">
                    도형 설정
                  </p>
                  <button
                    onClick={handleResetBox}
                    className="rounded-md border border-ink/10 px-2 py-1 text-[10px] font-medium text-ink/40 transition-colors hover:border-ink/20 hover:text-ink/70"
                  >
                    초기화
                  </button>
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-[11px] text-ink/50">3D 가이드</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { v: "off", label: "끄기" },
                        { v: "wire", label: "선" },
                        { v: "solid", label: "면" },
                      ] as { v: BoxRenderMode; label: string }[]
                    ).map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => setBoxRenderMode(v)}
                        className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                          boxRenderMode === v
                            ? "bg-white text-accent shadow-sm"
                            : "border border-ink/10 text-ink/50 hover:bg-ink/5"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <SliderRow label="박스 투명도" value={boxOpacity} min={0.3} max={1} accent="accent-violet-500" onChange={setBoxOpacity} />

                {selectedBoxKey === "rib" && (
                  <>
                    <div className="my-3 text-[10px] font-semibold uppercase tracking-widest text-violet-500/70">가슴</div>
                    <SliderRow label="크기" value={ribcageScale} min={0.7} max={1.5} accent="accent-indigo-500" onChange={setRibcageScale} />
                    <SliderRow label="높이" value={ribHeightScale} min={0.6} max={1.6} accent="accent-cyan-500" onChange={setRibHeightScale} />
                  </>
                )}
                {selectedBoxKey === "waist" && (
                  <>
                    <div className="my-3 text-[10px] font-semibold uppercase tracking-widest text-violet-500/70">허리</div>
                    <SliderRow label="크기" value={waistScale} min={0.7} max={1.5} accent="accent-purple-500" onChange={setWaistScale} />
                    <SliderRow label="높이" value={waistHeightScale} min={0.6} max={1.6} accent="accent-fuchsia-500" onChange={setWaistHeightScale} />
                  </>
                )}
                {selectedBoxKey === "pelvis" && (
                  <>
                    <div className="my-3 text-[10px] font-semibold uppercase tracking-widest text-violet-500/70">골반</div>
                    <SliderRow label="크기" value={pelvisScale} min={0.7} max={1.5} accent="accent-yellow-500" onChange={setPelvisScale} />
                    <SliderRow label="높이" value={pelvisHeightScale} min={0.6} max={1.6} accent="accent-orange-500" onChange={setPelvisHeightScale} />
                  </>
                )}

                <div className="my-3 text-[10px] font-semibold uppercase tracking-widest text-ink/30">두께</div>
                <SliderRow label="박스" value={boxThickness} min={0.15} max={0.8} accent="accent-emerald-500" onChange={setBoxThickness} />
                <SliderRow label="상완" value={upperArmThickness} min={0.5} max={1.4} accent="accent-sky-500" onChange={setUpperArmThickness} />
                <SliderRow label="하완" value={lowerArmThickness} min={0.5} max={1.4} accent="accent-blue-500" onChange={setLowerArmThickness} />
                <SliderRow label="허벅지" value={thighThickness} min={0.5} max={1.4} accent="accent-amber-500" onChange={setThighThickness} />
                <SliderRow label="종아리" value={calfThickness} min={0.5} max={1.4} accent="accent-rose-500" onChange={setCalfThickness} />
              </div>
            )}

            {guideMode !== "box" && (
              <div className="flex flex-1 items-center justify-center p-5">
                <p className="text-center text-xs text-ink/25">
                  {guideMode === "none"
                    ? "상단에서 가이드 모드를 선택하세요"
                    : "도형화 모드에서 상세 설정을 조절할 수 있습니다"}
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  /* ─────────────────────── GRID VIEW ───────────────────────────────────── */
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-paper">
      <header className="flex h-12 shrink-0 items-center border-b border-ink/[0.06] bg-paper px-5">
        <div className="flex flex-1 items-center gap-2.5">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/40" />
          <span className="text-sm font-semibold tracking-tight text-ink">Draw Dream</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink/40">
            오늘 {todayRecord?.poseCount ?? 0}회
          </span>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-xs text-ink/50 transition-colors hover:text-ink/80"
          >
            대시보드
          </Link>
          <button
            onClick={fetchPhotos}
            className="rounded-lg border border-accent/30 bg-white px-4 py-1.5 text-xs font-semibold text-accent shadow-sm transition-colors hover:bg-accent/5"
          >
            새 사진 불러오기
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink/40">사진 불러오는 중…</p>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-ink/50">{error}</p>
            <button
              onClick={fetchPhotos}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm shadow-accent/30 hover:opacity-90"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && photos.length > 0 && (
          <>
            <p className="mb-4 text-xs text-ink/40">
              사진을 클릭하면 도형화 연습을 시작합니다 · {photos.length}장
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => handleSelectPhoto(photo)}
                  className="group relative overflow-hidden rounded-xl bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="aspect-[3/4]">
                    <img
                      src={photo.urls.regular}
                      alt={photo.alt_description ?? "pose photo"}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
                    <div className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-ink shadow">
                      연습 시작
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                    <p className="truncate text-[10px] text-white/70">© {photo.user.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

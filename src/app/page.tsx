"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [detectionFailed, setDetectionFailed] = useState(false);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set());
  const loaderRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);
  const [guideMode, setGuideMode] = useState<GuideMode>("none");
  const [landmarksReady, setLandmarksReady] = useState(false);
  const [practiceZoom, setPracticeZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const isSpaceRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panBaseRef = useRef({ x: 0, y: 0 });

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

  const fetchPhotos = useCallback(async (pageNum: number) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await fetch(`/api/unsplash?page=${pageNum}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      const newPhotos: UnsplashPhoto[] = Array.isArray(data) ? data : [];
      if (newPhotos.length === 0) {
        setHasMore(false);
      } else {
        setPhotos((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = newPhotos.filter((p) => {
            if (existingIds.has(p.id)) return false;
            existingIds.add(p.id);
            return true;
          });
          return pageNum === 1 ? unique : [...prev, ...unique];
        });
        pageRef.current = pageNum + 1;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러올 수 없습니다.");
      if (pageNum === 1) setPhotos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

useEffect(() => {
    fetchPhotos(1);
  }, [fetchPhotos]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
          fetchPhotos(pageRef.current);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, fetchPhotos]);

  useEffect(() => {
    if (guideMode !== "box") setSelectedBoxKey(null);
  }, [guideMode]);

  const handleLandmarks = useCallback((lm: import("@/components/PoseOverlay").PoseLandmarks | null) => {
    if (lm) {
      setLandmarksReady(true);
      setDetectionFailed(false);
    } else {
      setDetectionFailed(true);
    }
  }, []);

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
    history.pushState({ photo }, "");
    setSelectedPhoto(photo);
    setGuideMode("none");
    setLandmarksReady(false);
    setDetectionFailed(false);
    setPracticeZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  };

  const handleBack = () => {
    if (detectionFailed && selectedPhoto) {
      setFailedPhotoIds((prev) => new Set([...prev, selectedPhoto.id]));
    }
    setDetectionFailed(false);
    setSelectedPhoto(null);
    setGuideMode("none");
  };

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.photo) {
        setSelectedPhoto(e.state.photo);
        setGuideMode("none");
        setLandmarksReady(false);
        setPracticeZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else {
        setSelectedPhoto(null);
        setGuideMode("none");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        isSpaceRef.current = true;
        setIsSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceRef.current = false;
        setIsSpaceHeld(false);
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };
    const onMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [selectedPhoto]);

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
              {guideTabs.map(({ key, label }) => {
                const disabled = key === "box" && !landmarksReady;
                return (
                  <button
                    key={key}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setGuideMode(key);
                      if (key === "box" && boxRenderMode === "off") setBoxRenderMode("wire");
                    }}
                    className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
                      guideMode === key
                        ? "bg-white text-accent shadow-sm"
                        : disabled
                        ? "text-ink/25 cursor-not-allowed"
                        : "text-ink/60 hover:text-ink hover:bg-ink/[0.06]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
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
          {/* 왼쪽: 참고 사진 */}
          <section className="relative flex flex-1 items-center justify-center overflow-hidden border-r border-ink/[0.06] bg-ink/[0.03]">
            <img
              src={selectedPhoto.urls.full ?? selectedPhoto.urls.regular}
              alt="참고 사진"
              className="max-h-full max-w-full object-contain"
              style={{ filter: "contrast(1.05)" }}
            />
            <div className="absolute left-2 top-2 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/70">참고</div>
          </section>

          {/* 오른쪽: 연습 사진 */}
          <section
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink/[0.03]"
            style={{ cursor: isPanning ? "grabbing" : isSpaceHeld ? "grab" : "default" }}
            onWheel={(e) => {
              e.preventDefault();
              setPracticeZoom((prev) => Math.min(4, Math.max(0.3, prev - e.deltaY * 0.001)));
            }}
            onMouseDown={(e) => {
              if (isSpaceRef.current) {
                e.preventDefault();
                isPanningRef.current = true;
                setIsPanning(true);
                panStartRef.current = { x: e.clientX, y: e.clientY };
                panBaseRef.current = { ...panOffset };
              }
            }}
            onMouseMove={(e) => {
              if (isPanningRef.current) {
                setPanOffset({
                  x: panBaseRef.current.x + (e.clientX - panStartRef.current.x),
                  y: panBaseRef.current.y + (e.clientY - panStartRef.current.y),
                });
              }
            }}
          >
            <div className="absolute left-2 top-2 z-10 rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/70">연습</div>
            <div
              className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2.5 text-center text-xs text-white/90 backdrop-blur-sm pointer-events-none"
              style={{ transition: "opacity 0.8s ease", opacity: showHint ? 1 : 0 }}
            >
              <div className="mb-0.5 font-medium">캔버스 조작</div>
              <div className="text-white/60">Space + 드래그 · 이동 &nbsp;·&nbsp; 휠 · 줌 인/아웃</div>
            </div>
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
              <button
                onPointerDown={() => setPracticeZoom((p) => Math.min(4, +(p + 0.2).toFixed(2)))}
                className="rounded bg-black/30 px-2 py-0.5 text-sm text-white/70 hover:bg-black/50"
              >+</button>
              <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-white/60 tabular-nums">
                {Math.round(practiceZoom * 100)}%
              </span>
              <button
                onPointerDown={() => setPracticeZoom((p) => Math.max(0.3, +(p - 0.2).toFixed(2)))}
                className="rounded bg-black/30 px-2 py-0.5 text-sm text-white/70 hover:bg-black/50"
              >−</button>
              {practiceZoom !== 1 && (
                <button
                  onPointerDown={() => setPracticeZoom(1)}
                  className="rounded bg-black/30 px-2 py-0.5 text-[10px] text-white/70 hover:bg-black/50"
                >↺</button>
              )}
            </div>
            <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${practiceZoom})`, transformOrigin: "center center", transition: isPanning ? "none" : "transform 0.05s ease-out" }}>
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
              onLandmarks={handleLandmarks}
              zoom={practiceZoom}
            />
            </div>
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
                  {failedPhotoIds.has(photo.id) && (
                    <div className="absolute right-2 top-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-medium text-white">
                      감지 불가
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        <div ref={loaderRef} className="mt-6 flex justify-center pb-6">
          {loadingMore && <p className="text-sm text-ink/40">사진 불러오는 중…</p>}
          {!hasMore && photos.length > 0 && <p className="text-xs text-ink/30">모든 사진을 불러왔습니다</p>}
        </div>
      </div>
    </main>
  );
}

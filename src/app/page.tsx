"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PoseOverlay, { BoxKey, BoxUpdateInfo, GizmoMode, PoseOverlayHandle } from "@/components/PoseOverlay";
import { getTodayRecord, savePracticeRecord, savePoseImage } from "@/lib/storage";

type GuideMode = "none" | "skeleton" | "box";
type BoxRenderMode = "off" | "wire" | "solid";

const BOX_KEY_LABEL: Record<string, string> = {
  head: "머리",
  rib: "가슴",
  waist: "허리",
  pelvis: "골반",
  leftUpperArm: "왼쪽 상완",
  rightUpperArm: "오른쪽 상완",
  leftLowerArm: "왼쪽 하완",
  rightLowerArm: "오른쪽 하완",
  leftThigh: "왼쪽 허벅지",
  rightThigh: "오른쪽 허벅지",
  leftCalf: "왼쪽 종아리",
  rightCalf: "오른쪽 종아리",
};

type UnsplashPhoto = {
  id: string;
  urls: { regular: string; full?: string };
  user: { name: string; username: string };
  alt_description?: string;
};

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
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
  const isMidButtonRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panBaseRef = useRef({ x: 0, y: 0 });

  const poseOverlayRef = useRef<PoseOverlayHandle>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [liveBoxInfo, setLiveBoxInfo] = useState<BoxUpdateInfo | null>(null);
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set());

  const flashButton = useCallback((key: string) => {
    setActiveButtons((prev) => { const n = new Set(prev); n.add(key); return n; });
    setTimeout(() => setActiveButtons((prev) => { const n = new Set(prev); n.delete(key); return n; }), 200);
  }, []);

  const [boxRenderMode, setBoxRenderMode] = useState<BoxRenderMode>("wire");
  const [boxOpacity, setBoxOpacity] = useState(0.85);
  const [selectedBoxKey, setSelectedBoxKey] = useState<BoxKey | null>(null);
  const [rotEdit, setRotEdit] = useState({ x: "0.0", y: "0.0", z: "0.0" });
  const [scaleEdit, setScaleEdit] = useState({ x: "1.00", y: "1.00", z: "1.00" });
  const inputFocused = useRef(new Set<string>());
  const [lockedKeys, setLockedKeys] = useState<Set<BoxKey>>(new Set());
  const [photoOpacity, setPhotoOpacity] = useState(1);
  const [photoGrayscale, setPhotoGrayscale] = useState(false);
  const boxModeStartRef = useRef<number | null>(null);  // 도형화 모드 시작 시각
  const boxAccumSecRef = useRef(0);                     // 누적 초 (이전 세션 포함)
  const [liveTimerSec, setLiveTimerSec] = useState(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    setTodayCount(getTodayRecord()?.poseCount ?? 0);
  }, []);

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
    if (selectedPhoto) return; // 상세 뷰에서는 sentinel이 없으므로 skip
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !error && !fetchingRef.current) {
          fetchPhotos(pageRef.current);
        }
      },
      { threshold: 0, rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, error, fetchPhotos, selectedPhoto]);

  // 로드 완료 후 sentinel이 여전히 화면 안에 있으면 추가 로드
  useEffect(() => {
    if (selectedPhoto) return;
    if (loading || loadingMore || !hasMore || !!error) return;
    const el = loaderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 400) {
      fetchPhotos(pageRef.current);
    }
  }, [loading, loadingMore, hasMore, error, fetchPhotos, selectedPhoto]);

  useEffect(() => {
    if (guideMode !== "box") setSelectedBoxKey(null);
  }, [guideMode]);

  // 도형화 모드 진입 시 타이머 시작, 이탈 시 누적
  useEffect(() => {
    if (guideMode === "box") {
      boxModeStartRef.current = Date.now();
    } else {
      if (boxModeStartRef.current !== null) {
        boxAccumSecRef.current += Math.floor((Date.now() - boxModeStartRef.current) / 1000);
        boxModeStartRef.current = null;
      }
    }
  }, [guideMode]);

  // 1초마다 화면 갱신
  useEffect(() => {
    if (guideMode !== "box") return;
    const id = setInterval(() => {
      const start = boxModeStartRef.current;
      if (start !== null) {
        setLiveTimerSec(boxAccumSecRef.current + Math.floor((Date.now() - start) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [guideMode]);

  useEffect(() => {
    if (gizmoMode === "translate") setLiveBoxInfo(null);
  }, [gizmoMode]);

  const handleLandmarks = useCallback((lm: import("@/components/PoseOverlay").PoseLandmarks | null) => {
    if (lm) {
      setLandmarksReady(true);
      setDetectionFailed(false);
    } else {
      setDetectionFailed(true);
    }
  }, []);

  const handleBoxChange = useCallback((info: BoxUpdateInfo) => {
    setLiveBoxInfo(info);
  }, []);

  const handleToggleLock = useCallback((key: BoxKey) => {
    setLockedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // 잠글 때 해당 박스가 선택된 상태면 선택 해제
        if (selectedBoxKey === key) {
          poseOverlayRef.current?.deselect();
        }
      }
      return next;
    });
  }, [selectedBoxKey]);

  // selectedBoxKey 변경 시 입력값 초기화
  useEffect(() => {
    setRotEdit({ x: "0.0", y: "0.0", z: "0.0" });
    setScaleEdit({ x: "1.00", y: "1.00", z: "1.00" });
  }, [selectedBoxKey]);

  // 드래그 중 실시간 동기화 (포커스된 필드는 제외)
  useEffect(() => {
    if (!liveBoxInfo || liveBoxInfo.key !== selectedBoxKey) return;
    const r = liveBoxInfo.rotEulerDeg;
    const sv = liveBoxInfo.scaleVec as unknown as Record<string, number>;
    if (!inputFocused.current.has("rx")) setRotEdit(p => ({ ...p, x: r.x.toFixed(1) }));
    if (!inputFocused.current.has("ry")) setRotEdit(p => ({ ...p, y: r.y.toFixed(1) }));
    if (!inputFocused.current.has("rz")) setRotEdit(p => ({ ...p, z: r.z.toFixed(1) }));
    if (!inputFocused.current.has("sx")) setScaleEdit(p => ({ ...p, x: sv["x"].toFixed(2) }));
    if (!inputFocused.current.has("sy")) setScaleEdit(p => ({ ...p, y: sv["y"].toFixed(2) }));
    if (!inputFocused.current.has("sz")) setScaleEdit(p => ({ ...p, z: sv["z"].toFixed(2) }));
  }, [liveBoxInfo, selectedBoxKey]);

  const handleSelectPhoto = (photo: UnsplashPhoto) => {
    savedScrollRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    history.pushState({ photo }, "");
    setSelectedPhoto(photo);
    setGuideMode("none");
    setLandmarksReady(false);
    setDetectionFailed(false);
    setPracticeZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
    boxModeStartRef.current = null;
    boxAccumSecRef.current = 0;
    setLiveTimerSec(0);
  };

  const restoreScroll = () => {
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: savedScrollRef.current });
    });
  };

  const handleBack = () => {
    if (detectionFailed && selectedPhoto) {
      setFailedPhotoIds((prev) => { const next = new Set(prev); next.add(selectedPhoto.id); return next; });
    }
    setDetectionFailed(false);
    setSelectedPhoto(null);
    setGuideMode("none");
    boxModeStartRef.current = null;
    boxAccumSecRef.current = 0;
    setLiveTimerSec(0);
    restoreScroll();
  };

  const handleSave = useCallback(async () => {
    if (!selectedPhoto) return;
    const today = new Date().toISOString().slice(0, 10);
    // 현재 세션 누적 포함 총 초
    const currentSec = boxModeStartRef.current !== null
      ? boxAccumSecRef.current + Math.floor((Date.now() - boxModeStartRef.current) / 1000)
      : boxAccumSecRef.current;
    const elapsed = Math.floor(currentSec / 60);
    const capturedUrl = await poseOverlayRef.current?.captureImage() ?? selectedPhoto.urls.regular;
    savePracticeRecord({ date: today, poseCount: 1, totalMinutes: elapsed });
    savePoseImage({
      id: `${Date.now()}`,
      date: today,
      imageUrl: capturedUrl,
      guideMode,
      authorName: selectedPhoto.user.name,
      savedAt: new Date().toISOString(),
    });
    // 저장 후 타이머 리셋
    boxAccumSecRef.current = 0;
    if (boxModeStartRef.current !== null) boxModeStartRef.current = Date.now();
    setLiveTimerSec(0);
    setTodayCount((prev) => prev + 1);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }, [selectedPhoto, guideMode]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.photo) {
        setSelectedPhoto(e.state.photo);
        setGuideMode("none");
        setLandmarksReady(false);
        setPracticeZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else {
        if (detectionFailed && selectedPhoto) {
          setFailedPhotoIds((prev) => { const next = new Set(prev); next.add(selectedPhoto.id); return next; });
        }
        setDetectionFailed(false);
        setSelectedPhoto(null);
        setGuideMode("none");
        restoreScroll();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [detectionFailed, selectedPhoto]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        isSpaceRef.current = true;
        setIsSpaceHeld(true);
      }
      if (e.code === "KeyL" && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        setSelectedBoxKey((key) => {
          if (key) {
            setLockedKeys((prev) => {
              const next = new Set(prev);
              if (next.has(key)) { next.delete(key); }
              else { next.add(key); poseOverlayRef.current?.deselect(); }
              return next;
            });
          }
          return key;
        });
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
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) isMidButtonRef.current = false;
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

  const todayRecord = getTodayRecord(); // grid view에서만 사용

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

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
                  <div key={key} className="group relative">
                    <button
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
                    {disabled && (
                      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/80 px-2.5 py-1.5 text-[11px] text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                        스켈레톤 클릭 후 사용 가능합니다
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-ink/80" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
            <span className="text-[11px] text-ink/40">
              오늘 {todayCount}회
            </span>
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-xs text-ink/50 transition-colors hover:text-ink/80"
            >
              대시보드
            </Link>
            <a
              href="https://ko-fi.com/drawdream"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-[#FF5E5B] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              ☕ 커피 한 잔
            </a>
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
              if (e.button === 1) e.preventDefault();
              if (isSpaceRef.current || e.button === 1) {
                isMidButtonRef.current = e.button === 1;
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
              <div className="text-white/60">Space + 드래그 · 이동 &nbsp;·&nbsp; 휠클릭 + 드래그 · 이동 &nbsp;·&nbsp; 휠 · 줌</div>
            </div>
            <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-2">
              {/* 줌 버튼 */}
              <div className="flex items-center gap-1">
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

              {/* 도형화 컨트롤 버튼 — 세로 나열 */}
              {guideMode === "box" && (
                <div className="flex flex-col gap-1 w-24">
                  {(["translate", "rotate", "scale"] as GizmoMode[]).map((mode) => {
                    const label = mode === "translate" ? "이동" : mode === "rotate" ? "회전" : "스케일";
                    const shortcut = mode === "translate" ? "T" : mode === "rotate" ? "R" : "S";
                    const isActive = activeButtons.has(mode);
                    const isSelected = gizmoMode === mode;
                    return (
                      <button
                        key={mode}
                        onPointerDown={() => {
                          poseOverlayRef.current?.setGizmoMode(mode);
                          flashButton(mode);
                        }}
                        className={`flex items-center justify-between rounded px-2.5 py-1.5 text-[11px] font-mono select-none transition-all duration-75 ${
                          isSelected
                            ? "bg-white/90 text-black shadow-[0_0_0_2px_rgba(255,255,255,0.6)]"
                            : "bg-black/40 text-white/60 hover:bg-black/60"
                        } ${isActive ? "scale-95 brightness-150" : "scale-100"}`}
                      >
                        <span>{label}</span>
                        <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] leading-none opacity-70">{shortcut}</span>
                      </button>
                    );
                  })}

                  {selectedBoxKey && (
                    <button
                      onPointerDown={() => {
                        poseOverlayRef.current?.deleteSelected();
                        flashButton("delete");
                      }}
                      className={`flex items-center justify-between rounded bg-red-500/80 px-2.5 py-1.5 text-[11px] text-white hover:bg-red-500 select-none transition-all duration-75 ${activeButtons.has("delete") ? "scale-95 brightness-150" : "scale-100"}`}
                    >
                      <span>삭제</span>
                      <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] leading-none opacity-70">⌫</span>
                    </button>
                  )}

                  {selectedBoxKey && (
                    <button
                      onPointerDown={() => handleToggleLock(selectedBoxKey)}
                      className="flex items-center justify-between rounded bg-blue-500/80 px-2.5 py-1.5 text-[11px] text-white hover:bg-blue-500 select-none transition-all duration-75"
                    >
                      <span>{lockedKeys.has(selectedBoxKey) ? "잠금해제" : "잠금"}</span>
                      <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] leading-none opacity-70">L</span>
                    </button>
                  )}

                  <button
                    onPointerDown={() => {
                      poseOverlayRef.current?.resetHidden();
                      flashButton("reset");
                    }}
                    className={`flex items-center justify-between rounded bg-orange-500/80 px-2.5 py-1.5 text-[11px] text-white hover:bg-orange-500 select-none transition-all duration-75 ${activeButtons.has("reset") ? "scale-95 brightness-150" : "scale-100"}`}
                  >
                    <span>초기화</span>
                    <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] leading-none opacity-70">Q</span>
                  </button>

                  <div className="flex flex-col items-center rounded bg-black/30 py-1.5 px-2 gap-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-white/40">TIME</span>
                    <span className="font-mono text-sm font-bold tabular-nums text-white/90">{formatTimer(liveTimerSec)}</span>
                  </div>

                  <button
                    onPointerDown={handleSave}
                    className="flex items-center justify-center rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-accent/40 hover:opacity-90 select-none transition-all duration-75"
                  >
                    저장하기
                  </button>
                </div>
              )}
            </div>
            <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${practiceZoom})`, transformOrigin: "center center", transition: isPanning ? "none" : "transform 0.05s ease-out" }}>
            <PoseOverlay
              ref={poseOverlayRef}
              imageSrc={selectedPhoto.urls.full ?? selectedPhoto.urls.regular}
              guideMode={guideMode}
              enable3DBox={true}
              boxRenderMode={boxRenderMode}
              boxOpacity={boxOpacity}
              lockedKeys={lockedKeys}
              photoOpacity={photoOpacity}
              photoGrayscale={photoGrayscale}
              onBoxChange={handleBoxChange}
              onSelectedKeyChange={(key) => { setSelectedBoxKey(key); if (!key) setLiveBoxInfo(null); }}
              onGizmoModeChange={setGizmoMode}
              onAction={flashButton}
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
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/30">
                      도형 설정
                    </p>
                    {selectedBoxKey && (
                      <p className="mt-0.5 text-[13px] font-semibold text-ink/70">
                        {BOX_KEY_LABEL[selectedBoxKey] ?? selectedBoxKey}
                      </p>
                    )}
                  </div>
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

                {/* 사진 설정 */}
                <div className="mb-4">
                  <p className="mb-2 text-[11px] text-ink/50">사진</p>
                  <button
                    onClick={() => setPhotoGrayscale((v) => !v)}
                    className={`mb-2 w-full rounded-md py-1.5 text-xs font-medium transition-all ${
                      photoGrayscale
                        ? "bg-white text-accent shadow-sm"
                        : "border border-ink/10 text-ink/50 hover:bg-ink/5"
                    }`}
                  >
                    흑백
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.01}
                      value={photoOpacity}
                      onChange={(e) => setPhotoOpacity(Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={0.1}
                      max={1}
                      step={0.01}
                      value={photoOpacity}
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0.1, Number(e.target.value)));
                        if (!isNaN(v)) setPhotoOpacity(v);
                      }}
                      className="w-14 rounded-md border border-ink/10 bg-transparent px-1.5 py-1 text-center text-xs text-ink/70 focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-ink/30">권장 0.4 – 0.6</p>
                </div>

                {/* 박스 투명도 */}
                <div className="mb-4">
                  <p className="mb-2 text-[11px] text-ink/50">박스 투명도</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={boxOpacity}
                      onChange={(e) => setBoxOpacity(Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={boxOpacity}
                      onChange={(e) => {
                        const v = Math.min(1, Math.max(0, Number(e.target.value)));
                        if (!isNaN(v)) setBoxOpacity(v);
                      }}
                      className="w-14 rounded-md border border-ink/10 bg-transparent px-1.5 py-1 text-center text-xs text-ink/70 focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                  </div>
                </div>

                {/* 실시간 변환 수치 — rotate/scale 모드에서 박스 선택 시 즉시 표시 */}
                {selectedBoxKey && gizmoMode !== "translate" && (
                  <div className="mb-4 rounded-lg bg-ink/[0.04] p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink/30">
                      {gizmoMode === "rotate" ? "회전 (°)" : "스케일"}
                    </p>
                    {gizmoMode === "rotate" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["x", "y", "z"] as const).map((axis) => {
                          const fid = `r${axis}`;
                          return (
                            <div key={axis} className="flex flex-col items-center rounded bg-ink/[0.06] py-1.5 px-1">
                              <span className="text-[9px] uppercase text-ink/30">{axis} °</span>
                              <input
                                type="number"
                                step={0.1}
                                value={rotEdit[axis]}
                                onFocus={() => inputFocused.current.add(fid)}
                                onBlur={() => inputFocused.current.delete(fid)}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                onChange={(e) => {
                                  const str = e.target.value;
                                  setRotEdit(p => ({ ...p, [axis]: str }));
                                  const v = parseFloat(str);
                                  if (!isNaN(v) && selectedBoxKey) {
                                    const rx = axis === "x" ? v : parseFloat(rotEdit.x);
                                    const ry = axis === "y" ? v : parseFloat(rotEdit.y);
                                    const rz = axis === "z" ? v : parseFloat(rotEdit.z);
                                    poseOverlayRef.current?.setRotationForKey(selectedBoxKey, rx, ry, rz);
                                  }
                                }}
                                className="mt-0.5 w-full bg-transparent text-center text-[11px] font-mono font-semibold text-ink/70 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {gizmoMode === "scale" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["x", "y", "z"] as const).map((axis) => {
                          const fid = `s${axis}`;
                          const label = axis === "y" ? "높이" : axis === "x" ? "너비" : "깊이";
                          return (
                            <div key={axis} className="flex flex-col items-center rounded bg-ink/[0.06] py-1.5 px-1">
                              <span className="text-[9px] uppercase text-ink/30">{label} ×</span>
                              <input
                                type="number"
                                step={0.01}
                                min={0.01}
                                value={scaleEdit[axis]}
                                onFocus={() => inputFocused.current.add(fid)}
                                onBlur={() => inputFocused.current.delete(fid)}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                onChange={(e) => {
                                  const str = e.target.value;
                                  setScaleEdit(p => ({ ...p, [axis]: str }));
                                  const v = parseFloat(str);
                                  if (!isNaN(v) && v > 0 && selectedBoxKey) {
                                    const sx = axis === "x" ? v : parseFloat(scaleEdit.x);
                                    const sy = axis === "y" ? v : parseFloat(scaleEdit.y);
                                    const sz = axis === "z" ? v : parseFloat(scaleEdit.z);
                                    poseOverlayRef.current?.setScaleForKey(selectedBoxKey, sx, sy, sz);
                                  }
                                }}
                                className="mt-0.5 w-full bg-transparent text-center text-[11px] font-mono font-semibold text-ink/70 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 잠긴 박스 목록 */}
            {guideMode === "box" && lockedKeys.size > 0 && (
              <div className="border-t border-ink/[0.06] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/70">잠긴 박스 {lockedKeys.size}개</p>
                  <button
                    onClick={() => setLockedKeys(new Set())}
                    className="text-[10px] text-ink/30 hover:text-ink/60"
                  >
                    전체 해제
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {Array.from(lockedKeys).map((key) => (
                    <div key={key} className="flex items-center justify-between rounded bg-blue-500/10 px-2.5 py-1.5">
                      <span className="text-[11px] text-blue-400/80">{BOX_KEY_LABEL[key] ?? key}</span>
                      <button
                        onClick={() => handleToggleLock(key)}
                        className="text-[10px] text-ink/30 hover:text-blue-400"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>
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

        {/* 저장 토스트 */}
        <div
          className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink/80 px-5 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm transition-all duration-300"
          style={{ opacity: toast ? 1 : 0, transform: `translateX(-50%) translateY(${toast ? "0px" : "12px"})` }}
        >
          저장되었습니다 ✓
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
            오늘 {todayCount}회
          </span>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-xs text-ink/50 transition-colors hover:text-ink/80"
          >
            대시보드
          </Link>
          <a
            href="https://ko-fi.com/drawdream"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-[#FF5E5B] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            ☕ 커피 한 잔
          </a>
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink/40">사진 불러오는 중…</p>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-ink/50">{error}</p>
            <button
              onClick={() => fetchPhotos(1)}
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

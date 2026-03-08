"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Timer from "@/components/Timer";
import PoseOverlay from "@/components/PoseOverlay";
import { getTodayRecord, savePracticeRecord } from "@/lib/storage";

const TOTAL_SECONDS = 3 * 60;

type GuideMode = "none" | "skeleton" | "box";
type BoxRenderMode = "off" | "wire" | "solid";

type UnsplashPhoto = {
  id: string;
  urls: { regular: string; full?: string };
  user: { name: string; username: string };
  alt_description?: string;
};

export default function Home() {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>("none");
  const [darkMode, setDarkMode] = useState(false);

  const [boxOpacity, setBoxOpacity] = useState(1);
  const [enable3DBox, setEnable3DBox] = useState(true);
  const [boxRenderMode, setBoxRenderMode] = useState<BoxRenderMode>("wire");
  const [ribcageScale, setRibcageScale] = useState(1.15);
  const [ribHeightScale, setRibHeightScale] = useState(1);
  const [waistScale, setWaistScale] = useState(1.0);
  const [waistHeightScale, setWaistHeightScale] = useState(1);
  const [pelvisScale, setPelvisScale] = useState(1.25);
  const [pelvisHeightScale, setPelvisHeightScale] = useState(1);
  const [boxThickness, setBoxThickness] = useState(0.8);
  const [upperArmThickness, setUpperArmThickness] = useState(1.4);
  const [lowerArmThickness, setLowerArmThickness] = useState(1.4);
  const [thighThickness, setThighThickness] = useState(1.4);
  const [calfThickness, setCalfThickness] = useState(1.4);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = Math.floor(Math.random() * 5) + 1;
      const res = await fetch(`/api/unsplash?page=${page}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPhotos(Array.isArray(data) ? data : []);
      setCurrentIndex(0);
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
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [isRunning, secondsLeft]);

  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);
    setGuideMode("skeleton");
    const today = new Date().toISOString().slice(0, 10);
    savePracticeRecord({
      date: today,
      poseCount: 1,
      totalMinutes: 3,
    });
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && isRunning) {
      setIsRunning(false);
      handleTimerComplete();
    }
  }, [secondsLeft, isRunning, handleTimerComplete]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(TOTAL_SECONDS);
    setGuideMode("none");
  };

  const activateStep2 = () => {
    setGuideMode("box");
    setEnable3DBox(true);
    if (boxRenderMode === "off") {
      setBoxRenderMode("wire");
    }
  };

  const currentPhoto = photos[currentIndex];
  const todayRecord = getTodayRecord();

  return (
    <main className="min-h-screen bg-paper dark:bg-paper-dark">
      <header className="border-b border-ink/10 px-6 py-4 dark:border-ink-dark/10">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-ink dark:text-ink-dark">
            인체 도형화 · 성장의 기록
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-muted hover:text-ink dark:hover:text-ink-dark"
            >
              대시보드
            </Link>
            <span className="text-sm text-muted">
              오늘 {todayRecord?.poseCount ?? 0}회 · {todayRecord?.totalMinutes ?? 0}분
            </span>
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm dark:border-ink-dark/20"
            >
              {darkMode ? "라이트" : "다크"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
          <section className="flex-1">
            <div className="rounded-xl border border-ink/10 bg-white/50 p-2 dark:border-ink-dark/10 dark:bg-black/20">
              {loading && (
                <div className="flex min-h-[50vh] items-center justify-center text-muted">불러오는 중…</div>
              )}
              {error && (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-muted">
                  <p>{error}</p>
                  <button
                    onClick={fetchPhotos}
                    className="rounded-lg bg-ink px-4 py-2 text-sm text-paper dark:bg-ink-dark dark:text-paper-dark"
                  >
                    다시 시도
                  </button>
                </div>
              )}
              {!loading && !error && currentPhoto && (
                <div className="relative flex justify-center">
                  <PoseOverlay
                    imageSrc={currentPhoto.urls.full ?? currentPhoto.urls.regular}
                    guideMode={guideMode}
                    boxOpacity={boxOpacity}
                    enable3DBox={enable3DBox}
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
                  />
                  {photos.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          setCurrentIndex((i) => (i - 1 + photos.length) % photos.length);
                          setGuideMode("none");
                        }}
                        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/60 bg-black/45 px-3 py-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/60"
                      >
                        이전
                      </button>
                      <button
                        onClick={() => {
                          setCurrentIndex((i) => (i + 1) % photos.length);
                          setGuideMode("none");
                        }}
                        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/60 bg-black/45 px-3 py-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/60"
                      >
                        다음
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="lg:w-80 lg:shrink-0">
            <div className="sticky top-6 space-y-8 rounded-xl border border-ink/10 bg-white/50 p-7 dark:border-ink-dark/10 dark:bg-black/20">
              <div>
                <h2 className="mb-4 text-sm font-medium text-muted">3분 연습 타이머</h2>
                <Timer
                  secondsLeft={secondsLeft}
                  isRunning={isRunning}
                  onStart={handleStart}
                  onPause={handlePause}
                  onReset={handleReset}
                />
              </div>

              <div className="border-t border-ink/10 pt-6 dark:border-ink-dark/10">
                <p className="mb-3 text-xs font-medium text-muted">가이드 모드</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGuideMode("none")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      guideMode === "none"
                        ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                        : "border border-ink/30 bg-transparent hover:bg-ink/5 dark:border-ink-dark/30"
                    }`}
                  >
                    기본 사진
                  </button>
                  <button
                    onClick={() => setGuideMode("skeleton")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      guideMode === "skeleton"
                        ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                        : "border border-ink/30 bg-transparent hover:bg-ink/5 dark:border-ink-dark/30"
                    }`}
                  >
                    1단계 스켈레톤
                  </button>
                  <button
                    onClick={activateStep2}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      guideMode === "box"
                        ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                        : "border border-ink/30 bg-transparent hover:bg-ink/5 dark:border-ink-dark/30"
                    }`}
                  >
                    2단계 몸통 도형화
                  </button>
                </div>

                <div className="mt-3">
                  <button
                    onClick={() => setEnable3DBox((v) => !v)}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      enable3DBox
                        ? "bg-blue-600 text-white"
                        : "border border-ink/30 bg-transparent hover:bg-ink/5 dark:border-ink-dark/30"
                    }`}
                  >
                    3D 박스 {enable3DBox ? "ON" : "OFF"}
                  </button>
                </div>

                {guideMode === "box" && enable3DBox && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] leading-relaxed text-muted">
                      조작: 박스 클릭 선택 · 좌클릭 드래그 이동 · 우클릭 드래그 회전 · 마우스 휠 크기 조절
                    </p>
                    <div>
                      <p className="mb-1 block text-xs text-muted">3D 가이드 표시</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setBoxRenderMode("off")}
                          className={`rounded-lg px-2 py-1.5 text-xs ${
                            boxRenderMode === "off"
                              ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                              : "border border-ink/30"
                          }`}
                        >
                          가이드 끄기
                        </button>
                        <button
                          onClick={() => setBoxRenderMode("wire")}
                          className={`rounded-lg px-2 py-1.5 text-xs ${
                            boxRenderMode === "wire"
                              ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                              : "border border-ink/30"
                          }`}
                        >
                          선
                        </button>
                        <button
                          onClick={() => setBoxRenderMode("solid")}
                          className={`rounded-lg px-2 py-1.5 text-xs ${
                            boxRenderMode === "solid"
                              ? "bg-ink text-paper dark:bg-ink-dark dark:text-paper-dark"
                              : "border border-ink/30"
                          }`}
                        >
                          면
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        박스 투명도: {Math.round(boxOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="1"
                        step="0.05"
                        value={boxOpacity}
                        onChange={(e) => setBoxOpacity(parseFloat(e.target.value))}
                        className="w-full accent-ink dark:accent-ink-dark"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        가슴 박스 크기: {ribcageScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={ribcageScale}
                        onChange={(e) => setRibcageScale(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        가슴 박스 높이: {ribHeightScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={ribHeightScale}
                        onChange={(e) => setRibHeightScale(parseFloat(e.target.value))}
                        className="w-full accent-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        허리 박스 크기: {waistScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={waistScale}
                        onChange={(e) => setWaistScale(parseFloat(e.target.value))}
                        className="w-full accent-violet-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        허리 박스 높이: {waistHeightScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={waistHeightScale}
                        onChange={(e) => setWaistHeightScale(parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        골반 박스 크기: {pelvisScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={pelvisScale}
                        onChange={(e) => setPelvisScale(parseFloat(e.target.value))}
                        className="w-full accent-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        골반 박스 높이: {pelvisHeightScale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={pelvisHeightScale}
                        onChange={(e) => setPelvisHeightScale(parseFloat(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        박스 두께: {boxThickness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.15"
                        max="0.8"
                        step="0.05"
                        value={boxThickness}
                        onChange={(e) => setBoxThickness(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        상완 두께: {upperArmThickness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1.4"
                        step="0.05"
                        value={upperArmThickness}
                        onChange={(e) => setUpperArmThickness(parseFloat(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        하완 두께: {lowerArmThickness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1.4"
                        step="0.05"
                        value={lowerArmThickness}
                        onChange={(e) => setLowerArmThickness(parseFloat(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        허벅지 두께: {thighThickness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1.4"
                        step="0.05"
                        value={thighThickness}
                        onChange={(e) => setThighThickness(parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        종아리 두께: {calfThickness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1.4"
                        step="0.05"
                        value={calfThickness}
                        onChange={(e) => setCalfThickness(parseFloat(e.target.value))}
                        className="w-full accent-orange-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {currentPhoto && <p className="text-xs text-muted">© {currentPhoto.user.name} / Unsplash</p>}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

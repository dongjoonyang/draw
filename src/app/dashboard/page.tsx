"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import { getPracticeRecords, getSavedImages, SavedPoseImage } from "@/lib/storage";

export default function DashboardPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<{ date: string; poseCount: number; totalMinutes: number }[]>([]);
  const [savedImages, setSavedImages] = useState<SavedPoseImage[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getPracticeRecords());
    setSavedImages(getSavedImages());
  }, []);

  useEffect(() => {
    if (!chartRef.current || records.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5.Theme.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "date",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    const poseSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "포즈 횟수",
        xAxis,
        yAxis,
        valueYField: "poseCount",
        categoryXField: "date",
      })
    );

    poseSeries.columns.template.setAll({
      tooltipText: "{categoryX}: {valueY}회",
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
    });

    poseSeries.columns.template.adapters.add("fill", () => am5.color(0x7966f8));
    poseSeries.columns.template.adapters.add("stroke", () => am5.color(0x7966f8));

    const data = records.map((r) => ({
      date: r.date.slice(5),
      poseCount: r.poseCount,
      totalMinutes: r.totalMinutes,
    }));

    poseSeries.data.setAll(data);
    xAxis.data.setAll(data);

    return () => root.dispose();
  }, [records]);

  const totalPoses = records.reduce((s, r) => s + r.poseCount, 0);
  const totalMinutes = records.reduce((s, r) => s + r.totalMinutes, 0);

  const formatTotalTime = (min: number) => {
    if (min === 0) return "0분";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  };

  const stats = [
    { label: "총 포즈", value: `${totalPoses}회` },
    { label: "총 연습 시간", value: formatTotalTime(totalMinutes) },
    { label: "연습 일수", value: `${records.length}일` },
    {
      label: "평균/일",
      value: `${records.length ? Math.round(totalPoses / records.length) : 0}회`,
    },
  ];

  return (
    <main className="min-h-screen bg-paper">
      {/* Header */}
      <header className="flex h-12 items-center border-b border-ink/[0.06] bg-paper px-5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-ink/50 transition-colors hover:text-ink/80"
          >
            <span className="text-base">←</span>
            <span>돌아가기</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-violet-500/40" />
            <h1 className="text-sm font-semibold tracking-tight text-ink">
              성장의 기록
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-accent/30 hover:opacity-90"
          >
            연습 시작하기
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* Stats grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-ink/[0.06] bg-white/60 p-5"
            >
              <p className="text-xs text-ink/40">{label}</p>
              <p className="mt-1.5 text-2xl font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-ink/[0.06] bg-white/60 p-6">
          <h2 className="mb-1 text-sm font-semibold text-ink">주간 연습량</h2>
          <p className="mb-5 text-xs text-ink/40">날짜별 포즈 횟수</p>
          {records.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <div className="text-3xl opacity-20">📊</div>
              <p className="text-sm text-ink/30">아직 연습 기록이 없습니다</p>
            </div>
          ) : (
            <div ref={chartRef} className="h-[200px] w-full" />
          )}
        </div>

        {/* Saved images */}
        <div className="mt-6 rounded-xl border border-ink/[0.06] bg-white/60 p-6">
          <h2 className="mb-1 text-sm font-semibold text-ink">저장된 포즈</h2>
          <p className="mb-5 text-xs text-ink/40">날짜별 저장한 포즈 이미지</p>
          {savedImages.length === 0 ? (
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-2">
              <p className="text-sm text-ink/30">아직 저장된 포즈가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(
                savedImages.reduce<Record<string, SavedPoseImage[]>>((acc, img) => {
                  (acc[img.date] ??= []).push(img);
                  return acc;
                }, {})
              )
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, images]) => (
                  <div key={date}>
                    <p className="mb-3 text-xs font-semibold text-ink/40">{date} · {images.length}회</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {images.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => setLightboxUrl(img.imageUrl)}
                          className="group relative overflow-hidden rounded-lg bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div className="aspect-[3/4]">
                            <img
                              src={img.imageUrl}
                              alt="저장된 포즈"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                            <span className="scale-75 rounded-full bg-white/80 p-2 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                              <svg className="h-4 w-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6" />
                              </svg>
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="확대 보기"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}

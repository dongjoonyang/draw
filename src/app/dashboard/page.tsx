"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import { getPracticeRecords } from "@/lib/storage";

export default function DashboardPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<{ date: string; poseCount: number; totalMinutes: number }[]>([]);

  useEffect(() => {
    setRecords(getPracticeRecords());
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

  const stats = [
    { label: "총 포즈", value: `${totalPoses}회` },
    { label: "총 연습 시간", value: `${totalMinutes}분` },
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
              <Link
                href="/"
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white shadow-sm shadow-accent/30 hover:opacity-90"
              >
                연습 시작하기
              </Link>
            </div>
          ) : (
            <div ref={chartRef} className="h-[360px] w-full" />
          )}
        </div>
      </div>
    </main>
  );
}

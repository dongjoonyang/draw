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
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
    });

    poseSeries.columns.template.adapters.add("fill", (_, target) => {
      return am5.color(0x3b82f6);
    });

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

  return (
    <main className="min-h-screen bg-paper dark:bg-paper-dark">
      <header className="border-b border-ink/10 px-6 py-4 dark:border-ink-dark/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink dark:text-ink-dark">
            ← 인체 도형화 · 성장의 기록
          </Link>
          <h1 className="text-lg font-semibold text-ink dark:text-ink-dark">
            내가 심은 잔디
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-ink/10 bg-white/50 p-6 dark:border-ink-dark/10 dark:bg-black/20">
            <p className="text-sm text-muted">총 포즈</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-ink-dark">{totalPoses}회</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white/50 p-6 dark:border-ink-dark/10 dark:bg-black/20">
            <p className="text-sm text-muted">총 연습 시간</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-ink-dark">{totalMinutes}분</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white/50 p-6 dark:border-ink-dark/10 dark:bg-black/20">
            <p className="text-sm text-muted">연습 일수</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-ink-dark">{records.length}일</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-white/50 p-6 dark:border-ink-dark/10 dark:bg-black/20">
            <p className="text-sm text-muted">평균/일</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-ink-dark">
              {records.length ? Math.round(totalPoses / records.length) : 0}회
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white/50 p-6 dark:border-ink-dark/10 dark:bg-black/20">
          <h2 className="mb-4 text-lg font-semibold text-ink dark:text-ink-dark">
            주간 연습량
          </h2>
          {records.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center text-muted">
              아직 연습 기록이 없습니다. 메인에서 연습을 시작해보세요.
            </div>
          ) : (
            <div ref={chartRef} className="h-[400px] w-full" />
          )}
        </div>
      </div>
    </main>
  );
}

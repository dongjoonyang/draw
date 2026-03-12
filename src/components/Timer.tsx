"use client";

type Props = {
  secondsLeft: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
};

export default function Timer({
  secondsLeft,
  isRunning,
  onStart,
  onPause,
  onReset,
}: Props) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`font-mono text-4xl tabular-nums tracking-tight ${
          isRunning ? "text-accent" : "text-ink"
        }`}
      >
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
      <div className="flex gap-2">
        <button
          onClick={isRunning ? onPause : onStart}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm shadow-accent/30 transition-opacity hover:opacity-90"
        >
          {isRunning ? "일시정지" : "시작"}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:bg-ink/5"
        >
          리셋
        </button>
      </div>
    </div>
  );
}

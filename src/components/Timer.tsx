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
      <div className="font-mono text-5xl tabular-nums tracking-tight text-ink dark:text-ink-dark">
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
      <div className="flex gap-2">
        <button
          onClick={isRunning ? onPause : onStart}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper dark:bg-ink-dark dark:text-paper-dark"
        >
          {isRunning ? "일시정지" : "시작"}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg border border-ink/30 px-4 py-2 text-sm font-medium text-ink dark:border-ink-dark/30 dark:text-ink-dark"
        >
          리셋
        </button>
      </div>
    </div>
  );
}

export function WaveformBars({ data }: { data: number[] }) {
  const bars = data.length > 0 ? data.slice(-28) : Array(28).fill(0);
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {bars.map((v, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width: 3,
            height: v > 0 ? `${Math.max(4, v * 40)}px` : 4,
            background: v > 0 ? `rgba(255,255,255,${0.4 + v * 0.6})` : "rgba(255,255,255,0.12)",
          }}
        />
      ))}
    </div>
  );
}

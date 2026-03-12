interface WaveformProps {
  data: number[];
  isDark: boolean;
}

export function Waveform({ data, isDark }: WaveformProps) {
  const barHeight = 60;
  const barWidth = 4;
  const barGap = 2;
  const maxBars = Math.floor(window.innerWidth / (barWidth + barGap)) - 40;
  
  const displayData = data.slice(-maxBars).map((val) => {
    return Math.min(Math.max(val * 100, 5), 100);
  });

  return (
    <div className="flex items-center justify-center gap-1 h-20">
      {displayData.map((height, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-75 ${isDark ? 'bg-indigo-500' : 'bg-zinc-700'}`}
          style={{
            width: `${barWidth}px`,
            height: `${(height / 100) * barHeight}px`,
            opacity: 0.6 + (i / displayData.length) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo pulse */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 animate-pulse" style={{ background: 'linear-gradient(135deg, #8B5CF6, #5B21B6)' }}>
            <span className="text-white font-bold text-2xl">ن</span>
          </div>
          {/* Spinning ring */}
          <div className="absolute -inset-2">
            <div className="w-20 h-20 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
          </div>
        </div>
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

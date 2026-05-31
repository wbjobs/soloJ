import { useMoleculeStore } from "@/store/moleculeStore";
import { Expand } from "lucide-react";

export default function ExplodeSlider() {
  const { explodeFactor, setExplodeFactor } = useMoleculeStore();

  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Expand size={14} className="text-[#ff6b35]" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
            爆炸视图
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/30">
          {Math.round(explodeFactor * 100)}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={explodeFactor}
        onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          bg-white/[0.08]
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#ff6b35]
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,107,53,0.4)]
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-[#0a0e17]
          [&::-webkit-slider-thumb]:transition-shadow
          [&::-webkit-slider-thumb]:hover:shadow-[0_0_12px_rgba(255,107,53,0.6)]
          [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:h-3.5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#ff6b35]
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-[#0a0e17]
        "
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-white/20">收缩</span>
        <span className="text-[9px] text-white/20">扩散</span>
      </div>
    </div>
  );
}

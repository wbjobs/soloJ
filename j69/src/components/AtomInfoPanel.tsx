import { useMoleculeStore } from "@/store/moleculeStore";
import { ELEMENT_COLORS, ELEMENT_INFO, ELEMENT_RADII } from "@/types/molecule";
import { CircleDot, X, Zap, Hash, Box, Ruler } from "lucide-react";

export default function AtomInfoPanel() {
  const { current, selectedAtomIndex, selectAtom } = useMoleculeStore();

  if (!current || selectedAtomIndex === null) return null;

  const atom = current.atoms[selectedAtomIndex];
  if (!atom) return null;

  const info = ELEMENT_INFO[atom.element];
  const color = ELEMENT_COLORS[atom.element] || "#aa55ff";
  const radius = ELEMENT_RADII[atom.element] || 0.7;

  const bondedTo: { element: string; bondOrder: number }[] = [];
  for (const bond of current.bonds) {
    if (bond.from === selectedAtomIndex) {
      bondedTo.push({
        element: current.atoms[bond.to].element,
        bondOrder: bond.order,
      });
    } else if (bond.to === selectedAtomIndex) {
      bondedTo.push({
        element: current.atoms[bond.from].element,
        bondOrder: bond.order,
      });
    }
  }

  return (
    <div className="rounded-lg bg-white/[0.04] border border-[#00ffc8]/20 p-3 animate-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CircleDot size={14} className="text-[#00ffc8]" />
          <span className="text-xs font-semibold text-[#00ffc8]/80 uppercase tracking-wide">
            原子信息
          </span>
        </div>
        <button
          onClick={() => selectAtom(null)}
          className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border"
          style={{
            backgroundColor: color + "20",
            borderColor: color + "40",
            color: color,
          }}
        >
          {atom.element}
        </div>
        <div>
          <div className="text-sm font-semibold text-white/90">
            {info?.name || atom.element} · {info?.nameEn || atom.element}
          </div>
          <div className="text-[10px] text-white/30">
            索引 #{selectedAtomIndex} · {info?.group || "未知"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {info && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
            <Hash size={10} className="text-[#ff6b35]" />
            <span className="text-white/40">原子序数</span>
            <span className="ml-auto font-mono text-white/80">{info.atomicNumber}</span>
          </div>
        )}
        {info && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
            <Zap size={10} className="text-[#00ffc8]" />
            <span className="text-white/40">原子量</span>
            <span className="ml-auto font-mono text-white/80">{info.atomicMass}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
          <Ruler size={10} className="text-[#ff6b35]" />
          <span className="text-white/40">半径</span>
          <span className="ml-auto font-mono text-white/80">{radius} Å</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/[0.03]">
          <Box size={10} className="text-[#00ffc8]" />
          <span className="text-white/40">成键数</span>
          <span className="ml-auto font-mono text-white/80">{bondedTo.length}</span>
        </div>
      </div>

      <div className="mt-2 px-2 py-1.5 rounded bg-white/[0.03] text-xs">
        <span className="text-white/40">坐标</span>
        <span className="ml-2 font-mono text-white/70">
          ({atom.x.toFixed(3)}, {atom.y.toFixed(3)}, {atom.z.toFixed(3)})
        </span>
      </div>

      {bondedTo.length > 0 && (
        <div className="mt-2 px-2 py-1.5 rounded bg-white/[0.03] text-xs">
          <span className="text-white/40">连接</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {bondedTo.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04]"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ELEMENT_COLORS[b.element] || "#aa55ff" }}
                />
                <span className="text-white/70">{b.element}</span>
                <span className="text-white/30">
                  {b.bondOrder > 1 ? `×${b.bondOrder}` : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

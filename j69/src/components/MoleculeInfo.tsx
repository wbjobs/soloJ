import { useMoleculeStore } from "@/store/moleculeStore";
import { Atom, Weight, Hash } from "lucide-react";
import { ELEMENT_COLORS } from "@/types/molecule";

export default function MoleculeInfo() {
  const { current } = useMoleculeStore();
  if (!current) return null;

  const elementCounts: Record<string, number> = {};
  for (const atom of current.atoms) {
    elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Hash size={14} className="text-[#ff6b35]" />
        <span className="text-xs text-white/50">化学式</span>
        <span className="text-sm font-semibold text-[#ff6b35]">{current.formula}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <Weight size={14} className="text-[#00ffc8]" />
        <span className="text-xs text-white/50">分子量</span>
        <span className="text-sm font-semibold text-white/90">{current.molecularWeight}</span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <Atom size={14} className="text-[#00ffc8]" />
        <span className="text-xs text-white/50">原子组成</span>
        <div className="flex items-center gap-1.5">
          {Object.entries(elementCounts).map(([el, count]) => (
            <span key={el} className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: ELEMENT_COLORS[el] || "#aa55ff" }}
              />
              <span className="text-xs text-white/80">
                {el}<sub>{count}</sub>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="w-px h-4 bg-white/10" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">化学键</span>
        <span className="text-sm font-semibold text-white/90">{current.bonds.length}</span>
      </div>
    </div>
  );
}

import { useMoleculeStore } from "@/store/moleculeStore";
import { Beaker, ChevronRight } from "lucide-react";

export default function MoleculePanel() {
  const { list, selectedId, selectMolecule } = useMoleculeStore();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Beaker size={18} className="text-[#00ffc8]" />
        <span className="text-sm font-semibold tracking-wide text-[#00ffc8]/80 uppercase">
          分子列表
        </span>
      </div>
      {list.map((mol) => {
        const isActive = mol.id === selectedId;
        return (
          <button
            key={mol.id}
            onClick={() => selectMolecule(mol.id)}
            className={`
              group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
              transition-all duration-200 text-left
              ${isActive
                ? "bg-[#00ffc8]/10 border border-[#00ffc8]/30 shadow-[0_0_12px_rgba(0,255,200,0.1)]"
                : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
              }
            `}
          >
            <div className={`
              w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold
              ${isActive ? "bg-[#00ffc8]/20 text-[#00ffc8]" : "bg-white/[0.05] text-white/40"}
            `}>
              {mol.formula.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${isActive ? "text-[#00ffc8]" : "text-white/80"}`}>
                {mol.name}
              </div>
              <div className={`text-xs ${isActive ? "text-[#00ffc8]/60" : "text-white/30"}`}>
                {mol.formula} · {mol.atomCount} 原子
              </div>
            </div>
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${isActive ? "text-[#00ffc8] translate-x-0.5" : "text-white/20 group-hover:text-white/40"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

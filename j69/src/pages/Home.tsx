import { useEffect } from "react";
import { useMoleculeStore } from "@/store/moleculeStore";
import MoleculeViewer from "@/components/MoleculeViewer";
import MoleculePanel from "@/components/MoleculePanel";
import MoleculeInfo from "@/components/MoleculeInfo";
import ControlHints from "@/components/ControlHints";
import AtomInfoPanel from "@/components/AtomInfoPanel";
import ExplodeSlider from "@/components/ExplodeSlider";
import { Atom } from "lucide-react";

export default function Home() {
  const { current, fetchList } = useMoleculeStore();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <div className="w-screen h-screen bg-[#0a0e17] flex overflow-hidden">
      <aside className="w-72 shrink-0 border-r border-white/[0.06] bg-[#0a0e17]/80 backdrop-blur-xl flex flex-col p-4 gap-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-lg bg-[#00ffc8]/10 border border-[#00ffc8]/20 flex items-center justify-center">
            <Atom size={18} className="text-[#00ffc8]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white/90 tracking-tight">分子结构查看器</h1>
            <p className="text-[10px] text-white/30">3D Molecular Viewer</p>
          </div>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
          <MoleculePanel />
          <div className="h-px bg-white/[0.04]" />
          <AtomInfoPanel />
        </div>
        <div className="h-px bg-white/[0.06]" />
        <ExplodeSlider />
        <div className="h-px bg-white/[0.06]" />
        <ControlHints />
      </aside>

      <main className="flex-1 flex flex-col relative">
        <div className="flex-1 relative">
          {current ? (
            <MoleculeViewer atoms={current.atoms} bonds={current.bonds} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white/20 text-sm">加载中...</div>
            </div>
          )}

          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-xs text-white/40">
                {current ? `${current.name} · ${current.formula}` : "选择分子"}
              </span>
            </div>
          </div>
        </div>

        <div className="h-14 border-t border-white/[0.06] bg-[#0a0e17]/80 backdrop-blur-xl flex items-center px-6">
          <MoleculeInfo />
        </div>
      </main>
    </div>
  );
}

import { Mouse, Move, ZoomIn } from "lucide-react";

export default function ControlHints() {
  return (
    <div className="flex flex-col gap-2 text-[10px] text-white/30">
      <div className="flex items-center gap-2">
        <Mouse size={12} />
        <span>左键拖拽旋转</span>
      </div>
      <div className="flex items-center gap-2">
        <ZoomIn size={12} />
        <span>滚轮缩放</span>
      </div>
      <div className="flex items-center gap-2">
        <Move size={12} />
        <span>右键平移</span>
      </div>
    </div>
  );
}

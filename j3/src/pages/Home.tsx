import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Eye, Terminal, PlayCircle } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [room, setRoom] = useState('demo-room');

  const handleHost = () => {
    navigate(`/host?room=${encodeURIComponent(room)}`);
  };

  const handleViewer = () => {
    navigate(`/viewer?room=${encodeURIComponent(room)}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="max-w-md w-full p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-600 rounded-2xl mb-6">
            <Terminal className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">实时命令执行系统</h1>
          <p className="text-slate-400">主持人执行命令，观众实时查看输出</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              房间号
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="输入房间号"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>

          <div className="space-y-3">
            <button
              onClick={handleHost}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-cyan-500/25 group"
            >
              <Crown className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div>进入主持人模式</div>
                <div className="text-sm text-cyan-200 font-normal">可以输入并执行命令</div>
              </div>
            </button>

            <button
              onClick={handleViewer}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all group"
            >
              <Eye className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div>进入观众模式</div>
                <div className="text-sm text-slate-400 font-normal">只读查看命令输出</div>
              </div>
            </button>

            <button
              onClick={() => navigate('/playback')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-purple-700 hover:bg-purple-600 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/25 group"
            >
              <PlayCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div>回放终端会话</div>
                <div className="text-sm text-purple-200 font-normal">通过 Session ID 回放录制</div>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-slate-800/50 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">使用说明</h3>
          <ul className="text-sm text-slate-500 space-y-1">
            <li>• 主持人和观众使用相同的房间号加入</li>
            <li>• 主持人执行的命令输出会实时推送给所有观众</li>
            <li>• 支持多房间同时独立运行</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

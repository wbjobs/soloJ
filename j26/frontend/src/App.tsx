import { useCallback, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { VariableWatch } from '@/components/debugger/VariableWatch';
import { CallStack } from '@/components/debugger/CallStack';
import { BreakpointList } from '@/components/debugger/BreakpointList';
import { DebugControls } from '@/components/debugger/DebugControls';
import { Console } from '@/components/console/Console';
import { Toolbar } from '@/components/layout/Toolbar';
import { ProfilerPanel } from '@/components/profiler/ProfilerPanel';
import { usePyodide } from '@/services/pyodide/runtime';
import { useEditorStore } from '@/stores/editorStore';
import { useConsoleStore } from '@/stores/consoleStore';
import { useDebuggerStore } from '@/stores/debuggerStore';
import { useProfilerStore } from '@/stores/profilerStore';
import { Activity } from 'lucide-react';

function App() {
  const { status, loadedPackages, runCode, runWithProfiling, startDebugging, sendDebugCommand, loadPackage } = usePyodide();
  const { code } = useEditorStore();
  const { addOutput, clearOutputs, setLoading } = useConsoleStore();
  const { reset: resetDebugger } = useDebuggerStore();
  const { startProfiling, stopProfiling, clear: clearProfiler } = useProfilerStore();
  const [rightPanelTab, setRightPanelTab] = useState<'variables' | 'callstack' | 'breakpoints' | 'profiler'>('variables');
  const [bottomTab, setBottomTab] = useState<'console' | 'profiler'>('console');

  const handleRun = useCallback(async () => {
    clearOutputs();
    clearProfiler();
    setLoading(true);
    resetDebugger();

    try {
      const result = await runCode(code);
      if (result.stdout) {
        addOutput('stdout', result.stdout);
      }
      if (result.stderr) {
        addOutput('stderr', result.stderr);
      }
    } catch (error) {
      addOutput('stderr', `执行错误: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [code, runCode, clearOutputs, clearProfiler, setLoading, addOutput, resetDebugger]);

  const handleProfile = useCallback(async () => {
    clearOutputs();
    clearProfiler();
    setLoading(true);
    startProfiling();

    try {
      await runWithProfiling(code);
    } catch (error) {
      addOutput('stderr', `执行错误: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
      stopProfiling();
      setBottomTab('profiler');
    }
  }, [code, runWithProfiling, clearOutputs, clearProfiler, setLoading, startProfiling, stopProfiling, addOutput]);

  const handleDebug = useCallback(async () => {
    clearOutputs();
    clearProfiler();
    setLoading(true);
    startProfiling();
    await startDebugging(code);
    setLoading(false);
    setBottomTab('profiler');
  }, [code, startDebugging, clearOutputs, clearProfiler, setLoading, startProfiling]);

  const handleCommand = useCallback(async (command: string) => {
    if (command === 'restart') {
      resetDebugger();
      await handleDebug();
      return;
    }
    if (command === 'stop') {
      stopProfiling();
    }
    await sendDebugCommand(command);
  }, [sendDebugCommand, handleDebug, resetDebugger, stopProfiling]);

  const handleLoadPackage = useCallback(async (pkg: string): Promise<boolean> => {
    addOutput('stdout', `正在加载包: ${pkg}...`);
    const success = await loadPackage(pkg);
    if (success) {
      addOutput('stdout', `成功加载包: ${pkg}`);
    } else {
      addOutput('stderr', `加载包失败: ${pkg}`);
    }
    return success;
  }, [loadPackage, addOutput]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      <Toolbar loadedPackages={loadedPackages} onLoadPackage={handleLoadPackage} />
      
      <DebugControls
        onRun={handleRun}
        onDebug={handleDebug}
        onProfile={handleProfile}
        onCommand={handleCommand}
        pyodideStatus={status}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CodeEditor pyodideStatus={status} />
        </div>

        <div className="w-80 border-l border-gray-700 flex flex-col bg-gray-800">
          <div className="flex border-b border-gray-700">
            {(['variables', 'callstack', 'breakpoints', 'profiler'] as const).map((tab) => (
              <button
                key={tab}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  rightPanelTab === tab
                    ? 'text-white bg-gray-700 border-b-2 border-accent-blue'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setRightPanelTab(tab)}
              >
                {tab === 'variables' && '变量'}
                {tab === 'callstack' && '调用栈'}
                {tab === 'breakpoints' && '断点'}
                {tab === 'profiler' && <Activity className="w-3.5 h-3.5 inline mr-1" />}
                {tab === 'profiler' && '性能'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanelTab === 'variables' && <VariableWatch />}
            {rightPanelTab === 'callstack' && <CallStack />}
            {rightPanelTab === 'breakpoints' && <BreakpointList />}
            {rightPanelTab === 'profiler' && <ProfilerPanel />}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700">
        <div className="flex bg-gray-800 border-b border-gray-700">
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              bottomTab === 'console'
                ? 'text-white bg-gray-700 border-b-2 border-accent-blue'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setBottomTab('console')}
          >
            控制台
          </button>
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              bottomTab === 'profiler'
                ? 'text-white bg-gray-700 border-b-2 border-accent-blue'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setBottomTab('profiler')}
          >
            <Activity className="w-3.5 h-3.5 inline mr-1" />
            性能分析
          </button>
        </div>
        <div className="h-64 overflow-hidden">
          {bottomTab === 'console' && <Console />}
          {bottomTab === 'profiler' && <ProfilerPanel />}
        </div>
      </div>
    </div>
  );
}

export default App;

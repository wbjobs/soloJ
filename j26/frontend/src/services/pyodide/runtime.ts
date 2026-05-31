import { useState, useEffect, useCallback, useRef } from 'react';
import type { PyodideInterface } from 'pyodide';
import { useConsoleStore } from '@/stores/consoleStore';
import { useDebuggerStore } from '@/stores/debuggerStore';
import { useEditorStore } from '@/stores/editorStore';
import { useProfilerStore } from '@/stores/profilerStore';

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

const DEBUGGER_PY_CODE = `
import sys
import traceback
import json
import time
from io import StringIO
from collections import defaultdict

class DebuggerState:
    def __init__(self):
        self.breakpoints = {}
        self.is_paused = False
        self.is_running = False
        self.should_stop = False
        self.step_mode = None
        self.current_line = None
        self.call_stack = []
        self.locals_cache = {}
        self.target_stack_depth = None
        self.step_over_caller_line = None
        self.enable_profiling = True
        self.code_lines = []

debug_state = DebuggerState()

class Profiler:
    def __init__(self):
        self.line_stats = defaultdict(lambda: {
            'hit_count': 0,
            'total_time': 0.0,
            'self_time': 0.0,
            'min_time': float('inf'),
            'max_time': 0.0,
            'function_name': '',
        })
        self.function_stats = defaultdict(lambda: {
            'call_count': 0,
            'total_time': 0.0,
            'self_time': 0.0,
            'min_time': float('inf'),
            'max_time': 0.0,
            'start_line': 0,
            'end_line': 0,
        })
        self.call_stack = []
        self.last_line_time = None
        self.last_line_number = None
        self.last_function = None
        self.function_entry_times = {}
        self.total_time = 0.0
        self.start_time = None

    def start(self):
        self.start_time = time.perf_counter()
        self.line_stats.clear()
        self.function_stats.clear()
        self.call_stack.clear()
        self.last_line_time = None
        self.last_line_number = None
        self.last_function = None
        self.function_entry_times.clear()

    def stop(self):
        if self.start_time:
            self.total_time = time.perf_counter() - self.start_time

    def on_line(self, frame, lineno):
        current_time = time.perf_counter()
        func_name = frame.f_code.co_name
        
        if debug_state.code_lines and lineno - 1 < len(debug_state.code_lines):
            code = debug_state.code_lines[lineno - 1]
        else:
            code = ''
        
        stats = self.line_stats[lineno]
        stats['hit_count'] += 1
        stats['function_name'] = func_name
        if not stats.get('code'):
            stats['code'] = code
        
        if self.last_line_time is not None and self.last_line_number is not None:
            elapsed = current_time - self.last_line_time
            self.line_stats[self.last_line_number]['total_time'] += elapsed
            if elapsed < self.line_stats[self.last_line_number]['min_time']:
                self.line_stats[self.last_line_number]['min_time'] = elapsed
            if elapsed > self.line_stats[self.last_line_number]['max_time']:
                self.line_stats[self.last_line_number]['max_time'] = elapsed
        
        self.last_line_time = current_time
        self.last_line_number = lineno
        self.last_function = func_name

    def on_call(self, frame):
        func_name = frame.f_code.co_name
        current_time = time.perf_counter()
        
        self.function_entry_times[func_name] = current_time
        self.call_stack.append(func_name)
        
        func_stats = self.function_stats[func_name]
        func_stats['call_count'] += 1
        if func_stats['start_line'] == 0:
            func_stats['start_line'] = frame.f_code.co_firstlineno

    def on_return(self, frame, arg):
        func_name = frame.f_code.co_name
        current_time = time.perf_counter()
        
        if func_name in self.function_entry_times:
            elapsed = current_time - self.function_entry_times[func_name]
            func_stats = self.function_stats[func_name]
            func_stats['total_time'] += elapsed
            if func_stats['end_line'] == 0:
                func_stats['end_line'] = frame.f_lineno
            if elapsed < func_stats['min_time']:
                func_stats['min_time'] = elapsed
            if elapsed > func_stats['max_time']:
                func_stats['max_time'] = elapsed
            
            if self.call_stack:
                self.call_stack.pop()
        
        if self.last_line_number is not None:
            elapsed = current_time - self.last_line_time
            self.line_stats[self.last_line_number]['total_time'] += elapsed

    def get_line_profiles(self):
        profiles = []
        for lineno, stats in sorted(self.line_stats.items()):
            if stats['hit_count'] > 0:
                avg_time = stats['total_time'] / stats['hit_count'] if stats['hit_count'] > 0 else 0
                profiles.append({
                    'lineNumber': lineno,
                    'hitCount': stats['hit_count'],
                    'totalTime': stats['total_time'] * 1000,
                    'selfTime': stats['self_time'] * 1000,
                    'averageTime': avg_time * 1000,
                    'minTime': (stats['min_time'] if stats['min_time'] != float('inf') else 0) * 1000,
                    'maxTime': stats['max_time'] * 1000,
                    'functionName': stats.get('function_name', ''),
                    'code': stats.get('code', '')
                })
        return profiles

    def get_function_profiles(self):
        profiles = []
        for name, stats in self.function_stats.items():
            if stats['call_count'] > 0:
                avg_time = stats['total_time'] / stats['call_count'] if stats['call_count'] > 0 else 0
                profiles.append({
                    'name': name,
                    'callCount': stats['call_count'],
                    'totalTime': stats['total_time'] * 1000,
                    'selfTime': stats['self_time'] * 1000,
                    'averageTime': avg_time * 1000,
                    'minTime': (stats['min_time'] if stats['min_time'] != float('inf') else 0) * 1000,
                    'maxTime': stats['max_time'] * 1000,
                    'lineRanges': [stats['start_line'], stats['end_line']]
                })
        return profiles

    def get_flame_graph(self):
        root = {'name': 'root', 'value': self.total_time * 1000, 'children': []}
        
        function_times = defaultdict(float)
        for name, stats in self.function_stats.items():
            function_times[name] = stats['total_time'] * 1000
        
        for name, time_val in function_times.items():
            if name != '<module>' and time_val > 0:
                root['children'].append({
                    'name': name,
                    'value': time_val,
                    'children': [],
                    'selfTime': time_val
                })
        
        return root

profiler = Profiler()

def send_event(event_type, **data):
    """Send debug event to JavaScript"""
    try:
        import js
        event_data = json.dumps({'type': event_type, 'data': data})
        js.console.debug(f"DEBUG EVENT: {event_type}")
        if hasattr(js, 'onDebugEvent'):
            js.onDebugEvent(event_type, data)
    except Exception as e:
        pass

def extract_variables(frame_dict, max_depth=2):
    """Extract variables from frame with limited depth"""
    result = []
    for name, value in frame_dict.items():
        if name.startswith('__') and name.endswith('__'):
            continue
        try:
            var_type = type(value).__name__
            has_children = False
            children_count = 0
            
            if isinstance(value, (dict, list, tuple, set)):
                has_children = True
                try:
                    children_count = len(value)
                except:
                    pass
            
            if isinstance(value, dict):
                value_str = f"{{...}} ({children_count} items)"
            elif isinstance(value, list):
                value_str = f"[...] ({children_count} items)"
            elif isinstance(value, tuple):
                value_str = f"(...) ({children_count} items)"
            elif isinstance(value, set):
                value_str = f"{{...}} ({children_count} items)"
            elif isinstance(value, str) and len(value) > 100:
                value_str = repr(value[:100]) + "..."
            else:
                try:
                    value_str = repr(value)
                    if len(value_str) > 150:
                        value_str = value_str[:150] + "..."
                except:
                    value_str = f"<{var_type}>"
            
            result.append({
                'name': name,
                'type': var_type,
                'value': value_str,
                'expanded': False,
                'hasChildren': has_children,
                'children': []
            })
        except:
            pass
    return result

def get_call_stack():
    """Get current call stack"""
    stack = []
    frame = sys._getframe(1)
    level = 0
    while frame and level < 20:
        try:
            stack.append({
                'id': f"frame_{level}",
                'functionName': frame.f_code.co_name,
                'lineNumber': frame.f_lineno,
                'fileName': frame.f_code.co_filename,
                'locals': []
            })
        except:
            pass
        frame = frame.f_back
        level += 1
    return stack

def get_stack_depth(frame):
    """Calculate current stack depth for user code"""
    depth = 0
    f = frame
    while f:
        if f.f_code.co_filename in ('<string>', 'main.py'):
            depth += 1
        f = f.f_back
    return depth

def check_condition(condition, frame):
    """Check if a breakpoint condition is satisfied"""
    if not condition:
        return True
    try:
        return bool(eval(condition, frame.f_globals, frame.f_locals))
    except:
        return False

def trace_dispatch(frame, event, arg):
    """Custom trace function for debugging"""
    if debug_state.should_stop:
        debug_state.is_running = False
        return None
    
    if frame.f_code.co_filename not in ('<string>', 'main.py'):
        return trace_dispatch
    
    lineno = frame.f_lineno
    
    if event == 'call':
        profiler.on_call(frame)
        return trace_dispatch
    
    if event == 'return':
        profiler.on_return(frame, arg)
        return trace_dispatch
    
    if event == 'line':
        debug_state.current_line = lineno
        current_depth = get_stack_depth(frame)
        
        profiler.on_line(frame, lineno)
        
        should_pause = False
        
        if debug_state.step_mode:
            mode = debug_state.step_mode
            
            if mode == 'into':
                should_pause = True
                debug_state.step_mode = None
                
            elif mode == 'over':
                if debug_state.target_stack_depth is None:
                    debug_state.target_stack_depth = current_depth
                    debug_state.step_over_caller_line = lineno
                elif current_depth <= debug_state.target_stack_depth and lineno != debug_state.step_over_caller_line:
                    should_pause = True
                    debug_state.step_mode = None
                    debug_state.target_stack_depth = None
                    debug_state.step_over_caller_line = None
                
            elif mode == 'out':
                if debug_state.target_stack_depth is None:
                    debug_state.target_stack_depth = current_depth - 1
                elif current_depth <= debug_state.target_stack_depth:
                    should_pause = True
                    debug_state.step_mode = None
                    debug_state.target_stack_depth = None
                    debug_state.step_over_caller_line = None
                
        elif lineno in debug_state.breakpoints:
            bp = debug_state.breakpoints[lineno]
            if bp.get('enabled', True):
                if bp.get('isConditional', False):
                    if check_condition(bp.get('condition', ''), frame):
                        should_pause = True
                else:
                    should_pause = True
            debug_state.step_mode = None
            debug_state.target_stack_depth = None
            debug_state.step_over_caller_line = None
        
        if should_pause:
            debug_state.is_paused = True
            
            locals_data = extract_variables(frame.f_locals)
            globals_data = extract_variables({k: v for k, v in frame.f_globals.items() 
                                             if not k.startswith('__')})
            call_stack = get_call_stack()
            
            send_event('paused', 
                      line=lineno,
                      fileName=frame.f_code.co_filename,
                      locals=locals_data,
                      globals=globals_data,
                      callStack=call_stack)
            
            while debug_state.is_paused and not debug_state.should_stop:
                time.sleep(0.01)
    
    return trace_dispatch

def set_breakpoints(breakpoints_list):
    """Set breakpoints with conditions"""
    debug_state.breakpoints = {}
    for bp in breakpoints_list:
        lineno = bp.get('lineNumber')
        debug_state.breakpoints[lineno] = bp

def set_code_lines(code):
    """Set code lines for profiling"""
    debug_state.code_lines = code.split('\\n')

def step_over():
    """Step over next line"""
    debug_state.step_mode = 'over'
    debug_state.target_stack_depth = None
    debug_state.step_over_caller_line = None
    debug_state.is_paused = False

def step_into():
    """Step into function"""
    debug_state.step_mode = 'into'
    debug_state.target_stack_depth = None
    debug_state.step_over_caller_line = None
    debug_state.is_paused = False

def step_out():
    """Step out of function"""
    debug_state.step_mode = 'out'
    debug_state.target_stack_depth = None
    debug_state.step_over_caller_line = None
    debug_state.is_paused = False

def resume():
    """Resume execution"""
    debug_state.step_mode = None
    debug_state.target_stack_depth = None
    debug_state.step_over_caller_line = None
    debug_state.is_paused = False

def stop_debug():
    """Stop debugging"""
    debug_state.should_stop = True
    debug_state.is_paused = False

def run_with_debug(code):
    """Run code with debugging enabled"""
    debug_state.is_running = True
    debug_state.is_paused = False
    debug_state.should_stop = False
    debug_state.current_line = None
    debug_state.step_mode = None
    
    set_code_lines(code)
    profiler.start()
    
    old_trace = sys.gettrace()
    
    try:
        sys.settrace(trace_dispatch)
        send_event('started')
        
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        
        stdout_buffer = StringIO()
        stderr_buffer = StringIO()
        
        sys.stdout = stdout_buffer
        sys.stderr = stderr_buffer
        
        try:
            exec(code, {'__name__': '__main__'}, {})
            output = stdout_buffer.getvalue()
            if output:
                send_event('output', message=output)
        except Exception as e:
            error_output = stderr_buffer.getvalue()
            tb = traceback.format_exc()
            send_event('exception', error=f"{str(e)}\\n{tb}")
            if error_output:
                send_event('output', message=error_output)
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            
    finally:
        sys.settrace(old_trace)
        profiler.stop()
        debug_state.is_running = False
        
        line_profiles = profiler.get_line_profiles()
        function_profiles = profiler.get_function_profiles()
        flame_graph = profiler.get_flame_graph()
        
        send_event('profiling_done',
                  lineProfiles=line_profiles,
                  functionProfiles=function_profiles,
                  flameGraph=flame_graph,
                  totalTime=profiler.total_time * 1000)
        
        send_event('terminated')

def run_code(code):
    """Run code without debugging"""
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    
    stdout_buffer = StringIO()
    stderr_buffer = StringIO()
    
    sys.stdout = stdout_buffer
    sys.stderr = stderr_buffer
    
    try:
        exec(code, {'__name__': '__main__'}, {})
        return {
            'success': True,
            'stdout': stdout_buffer.getvalue(),
            'stderr': stderr_buffer.getvalue()
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': stdout_buffer.getvalue(),
            'stderr': stderr_buffer.getvalue() + '\\n' + traceback.format_exc()
        }
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr

def run_with_profiling(code):
    """Run code with only profiling (no debugging)"""
    set_code_lines(code)
    profiler.start()
    
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    
    stdout_buffer = StringIO()
    stderr_buffer = StringIO()
    
    sys.stdout = stdout_buffer
    sys.stderr = stderr_buffer
    
    success = True
    try:
        exec(code, {'__name__': '__main__'}, {})
    except Exception as e:
        success = False
        stderr_buffer.write('\\n' + traceback.format_exc())
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        profiler.stop()
    
    return {
        'success': success,
        'stdout': stdout_buffer.getvalue(),
        'stderr': stderr_buffer.getvalue(),
        'lineProfiles': profiler.get_line_profiles(),
        'functionProfiles': profiler.get_function_profiles(),
        'flameGraph': profiler.get_flame_graph(),
        'totalTime': profiler.total_time * 1000
    }
`;

export function usePyodide() {
  const [status, setStatus] = useState<'uninitialized' | 'loading' | 'ready' | 'error'>('uninitialized');
  const [progress, setProgress] = useState(0);
  const [loadedPackages, setLoadedPackages] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const initAttempted = useRef(false);

  const addOutput = useConsoleStore(state => state.addOutput);
  const { handleDebugEvent, setState: setDebugState } = useDebuggerStore();
  const breakpoints = useEditorStore(state => state.breakpoints);
  const { setProfiles: setProfilerData } = useProfilerStore();

  const initPyodide = useCallback(async (): Promise<PyodideInterface> => {
    if (pyodideInstance) {
      return pyodideInstance;
    }

    if (loadPromise) {
      return loadPromise;
    }

    setStatus('loading');
    setDebugState('initializing');

    loadPromise = (async () => {
      try {
        const { loadPyodide } = await import('pyodide');
        
        const pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
          stdout: (text: string) => {
            if (text && text.trim()) {
              addOutput('stdout', text);
            }
          },
          stderr: (text: string) => {
            if (text && text.trim()) {
              addOutput('stderr', text);
            }
          },
        });

        setProgress(50);

        await pyodide.loadPackage(['micropip']);
        setProgress(75);

        await pyodide.runPythonAsync(DEBUGGER_PY_CODE);
        setProgress(100);

        (window as any).onDebugEvent = (eventType: string, data: any) => {
          handleDebugEvent({ type: eventType as any, data });
          
          if (eventType === 'profiling_done') {
            setProfilerData(
              data.lineProfiles,
              data.functionProfiles,
              data.flameGraph,
              data.totalTime
            );
          }
        };

        pyodideInstance = pyodide;
        setStatus('ready');
        setDebugState('ready');
        setLoadedPackages(['micropip']);
        
        return pyodide;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load Pyodide';
        setError(errorMessage);
        setStatus('error');
        setDebugState('error');
        throw err;
      }
    })();

    return loadPromise;
  }, [addOutput, handleDebugEvent, setDebugState, setProfilerData]);

  const runCode = useCallback(async (code: string): Promise<{ success: boolean; stdout: string; stderr: string }> => {
    const pyodide = await initPyodide();
    const result = await pyodide.runPythonAsync(`
      import json
      result = run_code(${JSON.stringify(code)})
      json.dumps(result)
    `);
    return JSON.parse(result);
  }, [initPyodide]);

  const runWithProfiling = useCallback(async (code: string) => {
    const pyodide = await initPyodide();
    const result = await pyodide.runPythonAsync(`
      import json
      result = run_with_profiling(${JSON.stringify(code)})
      json.dumps(result)
    `);
    const parsed = JSON.parse(result);
    
    if (parsed.stdout) {
      addOutput('stdout', parsed.stdout);
    }
    if (parsed.stderr) {
      addOutput('stderr', parsed.stderr);
    }
    
    setProfilerData(
      parsed.lineProfiles,
      parsed.functionProfiles,
      parsed.flameGraph,
      parsed.totalTime
    );
    
    return parsed;
  }, [initPyodide, addOutput, setProfilerData]);

  const startDebugging = useCallback(async (code: string) => {
    const pyodide = await initPyodide();
    
    const bpData = breakpoints.map(bp => ({
      lineNumber: bp.lineNumber,
      enabled: bp.enabled,
      isConditional: bp.isConditional,
      condition: bp.condition
    }));
    
    await pyodide.runPythonAsync(`
      set_breakpoints(${JSON.stringify(bpData)})
    `);

    setTimeout(async () => {
      try {
        await pyodide.runPythonAsync(`
          import threading
          debug_thread = threading.Thread(target=run_with_debug, args=(${JSON.stringify(code)},))
          debug_thread.start()
        `);
      } catch (err) {
        console.error('Debug error:', err);
      }
    }, 100);
  }, [initPyodide, breakpoints]);

  const sendDebugCommand = useCallback(async (command: string) => {
    if (!pyodideInstance) return;

    const commandMap: Record<string, string> = {
      'continue': 'resume()',
      'step_over': 'step_over()',
      'step_into': 'step_into()',
      'step_out': 'step_out()',
      'pause': '',
      'stop': 'stop_debug()',
    };

    const pyCommand = commandMap[command];
    if (pyCommand) {
      await pyodideInstance.runPythonAsync(pyCommand);
    }
  }, []);

  const loadPackage = useCallback(async (packageName: string) => {
    const pyodide = await initPyodide();
    
    try {
      await pyodide.loadPackage(packageName);
      setLoadedPackages(prev => [...new Set([...prev, packageName])]);
      return true;
    } catch {
      try {
        const micropip = pyodide.pyimport('micropip');
        await micropip.install(packageName);
        setLoadedPackages(prev => [...new Set([...prev, packageName])]);
        return true;
      } catch (err) {
        console.error(`Failed to load package ${packageName}:`, err);
        return false;
      }
    }
  }, [initPyodide]);

  useEffect(() => {
    if (!initAttempted.current) {
      initAttempted.current = true;
      initPyodide();
    }
  }, [initPyodide]);

  return {
    status,
    progress,
    error,
    loadedPackages,
    initPyodide,
    runCode,
    runWithProfiling,
    startDebugging,
    sendDebugCommand,
    loadPackage,
    pyodide: pyodideInstance,
  };
}

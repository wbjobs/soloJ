import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertTriangle, Shield, Zap } from 'lucide-react';
import AttackConsole from '@/components/AttackConsole';
import { useStore } from '@/store/useStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setCurrentAttack, addAttackRecord } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      const payload = `username=${username}&password=${password}`;
      setCurrentAttack(payload, data.executedSql, data.executionTime);

      addAttackRecord({
        payload,
        executedSql: data.executedSql,
        responseTime: data.executionTime,
        success: data.success,
        message: data.message,
        type: 'login',
      });

      if (data.success) {
        setUser(data.user);
        setMessage('登录成功!');
        setTimeout(() => navigate('/admin'), 1000);
      } else {
        setMessage(data.message);
      }
    } catch (error: any) {
      setMessage('连接服务器失败');
    } finally {
      setIsLoading(false);
    }
  };

  const examplePayloads = [
    { name: '普通登录', user: 'admin', pass: 'admin123' },
    { name: '万能密码 1', user: "admin' OR '1'='1", pass: "任意" },
    { name: '万能密码 2', user: "admin' -- ", pass: '' },
    { name: '联合查询', user: "' UNION SELECT 1,2,3,4 -- ", pass: '' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-full mb-4">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">SQL 注入靶场</h1>
            <p className="text-gray-400">字符型 SQL 注入漏洞演示</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 shadow-2xl">
            <div className="flex items-center gap-2 mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-400">
                警告：此页面存在 SQL 注入漏洞，用于安全学习演示！
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  用户名
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
                    placeholder="输入用户名"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
                    placeholder="输入密码"
                  />
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-center text-sm ${
                  message.includes('成功') 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                {isLoading ? '登录中...' : '登 录'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-3">示例 Payload：</p>
              <div className="grid grid-cols-2 gap-2">
                {examplePayloads.map((payload, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setUsername(payload.user);
                      setPassword(payload.pass);
                    }}
                    className="text-left p-2 bg-gray-900/50 hover:bg-gray-700/50 rounded text-xs text-gray-300 border border-gray-700 hover:border-red-500/50 transition-all font-mono"
                  >
                    <span className="text-red-400 font-bold">{payload.name}</span>
                    <br />
                    <span className="text-gray-500 truncate block">{payload.user}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/search')}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                前往数字盲注页面 →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-[480px] p-4">
        <AttackConsole />
      </div>
    </div>
  );
};

export default Login;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Package, LogOut, Shield, Settings } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface Stats {
  users: number;
  products: number;
  categories: number;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearUser } = useStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/me', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!data.success) {
        navigate('/');
        return;
      }

      fetchData();
    } catch (error) {
      navigate('/');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes, productsRes] = await Promise.all([
        fetch('http://localhost:3001/api/admin/stats', { credentials: 'include' }),
        fetch('http://localhost:3001/api/admin/users', { credentials: 'include' }),
        fetch('http://localhost:3001/api/admin/products', { credentials: 'include' }),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const productsData = await productsRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success) setUsers(usersData.users);
      if (productsData.success) setProducts(productsData.products);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('http://localhost:3001/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    clearUser();
    navigate('/');
  };

  const menuItems = [
    { id: 'dashboard', name: '仪表盘', icon: LayoutDashboard },
    { id: 'users', name: '用户管理', icon: Users },
    { id: 'products', name: '商品管理', icon: Package },
    { id: 'settings', name: '系统设置', icon: Settings },
  ];

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">管理后台</h1>
              <p className="text-xs text-gray-400">SQLi Lab Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-green-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.username || 'Admin'}</p>
              <p className="text-xs text-gray-500">{user?.role || 'Administrator'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">仪表盘</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">用户总数</p>
                      <p className="text-3xl font-bold text-white mt-1">{stats?.users || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">商品总数</p>
                      <p className="text-3xl font-bold text-white mt-1">{stats?.products || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">分类总数</p>
                      <p className="text-3xl font-bold text-white mt-1">{stats?.categories || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                      <LayoutDashboard className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">欢迎使用 SQL 注入靶场</h3>
                <div className="text-gray-400 space-y-2">
                  <p>恭喜你成功登录后台！这意味着你已经成功利用了 SQL 注入漏洞。</p>
                  <p className="mt-4">当前用户：<span className="text-green-400 font-mono">{user?.username}</span></p>
                  <p>用户角色：<span className="text-yellow-400 font-mono">{user?.role}</span></p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">用户管理</h2>
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">用户名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">创建时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm text-gray-300">{u.id}</td>
                        <td className="px-6 py-4 text-sm text-white font-mono">{u.username}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded ${
                            u.role === 'admin' 
                              ? 'bg-yellow-600/20 text-yellow-400' 
                              : 'bg-blue-600/20 text-blue-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">商品管理</h2>
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">商品名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">价格</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">分类</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm text-gray-300">{p.id}</td>
                        <td className="px-6 py-4 text-sm text-white">{p.name}</td>
                        <td className="px-6 py-4 text-sm text-green-400">¥{p.price}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{p.category_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">系统设置</h2>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">漏洞信息</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                    <p className="text-red-400 font-semibold mb-2">⚠️ 字符型 SQL 注入</p>
                    <p className="text-gray-400 text-sm">位置：登录接口 /api/auth/login</p>
                    <p className="text-gray-400 text-sm mt-1">参数：username, password</p>
                    <p className="text-gray-400 text-sm mt-1">示例：admin' OR '1'='1</p>
                  </div>
                  <div className="p-4 bg-orange-900/20 border border-orange-700 rounded-lg">
                    <p className="text-orange-400 font-semibold mb-2">⚠️ 数字型盲注</p>
                    <p className="text-gray-400 text-sm">位置：商品搜索接口 /api/products</p>
                    <p className="text-gray-400 text-sm mt-1">参数：categoryId</p>
                    <p className="text-gray-400 text-sm mt-1">示例：1 AND SLEEP(2)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;

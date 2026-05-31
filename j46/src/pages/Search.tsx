import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Package, AlertTriangle, Eye } from 'lucide-react';
import AttackConsole from '@/components/AttackConsole';
import { useStore } from '@/store/useStore';

interface Product {
  id: number;
  name: string;
  price: number;
  category_id: number;
  description: string;
}

interface Category {
  id: number;
  name: string;
}

const Search: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentAttack, addAttackRecord } = useStore();
  const [categoryId, setCategoryId] = useState('1');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
    handleSearch();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/products/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `http://localhost:3001/api/products?categoryId=${categoryId}`
      );
      const data = await response.json();

      setProducts(data.products || []);
      setCurrentAttack(categoryId, data.executedSql, data.executionTime);

      addAttackRecord({
        payload: `categoryId=${categoryId}`,
        executedSql: data.executedSql,
        responseTime: data.executionTime,
        success: data.products && data.products.length > 0,
        message: data.products ? `找到 ${data.products.length} 个商品` : '未找到商品',
        type: 'search',
      });
    } catch (error: any) {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const blindPayloads = [
    { name: '正常查询', value: '1' },
    { name: '布尔盲注-真', value: '1 AND 1=1' },
    { name: '布尔盲注-假', value: '1 AND 1=2' },
    { name: '时间盲注', value: '1 AND SLEEP(2)' },
    { name: '猜解库名长度', value: "1 AND (SELECT LENGTH(DATABASE()))=7" },
    { name: '猜解库名首字母', value: "1 AND (SELECT ASCII(SUBSTRING(DATABASE(),1,1)))=115" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex">
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">商品搜索</h1>
              <p className="text-gray-400">数字型 SQL 盲注漏洞演示</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              返回登录
            </button>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-400">
                警告：此接口存在数字型 SQL 盲注漏洞！可通过响应差异和时间延迟判断条件真假。
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  分类 ID (注入点)
                </label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                    placeholder="输入分类 ID 或注入语句"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  {isLoading ? '查询中...' : '搜索'}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">快捷 Payload：</p>
              <div className="flex flex-wrap gap-2">
                {blindPayloads.map((payload, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCategoryId(payload.value);
                    }}
                    className="px-3 py-1.5 bg-gray-900/50 hover:bg-gray-700/50 rounded text-xs text-gray-300 border border-gray-700 hover:border-orange-500/50 transition-all font-mono"
                  >
                    <span className="text-orange-400 font-bold">{payload.name}</span>
                    <span className="text-gray-500 ml-1">: {payload.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">可用分类：</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(String(cat.id))}
                    className={`px-3 py-1 rounded text-sm transition-all ${
                      categoryId === String(cat.id)
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {cat.name} (ID: {cat.id})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-green-400" />
                搜索结果
                <span className="text-sm font-normal text-gray-400">({products.length} 个商品)</span>
              </h2>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>未找到商品</p>
                <p className="text-sm mt-2">提示：观察页面差异进行布尔盲注</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 hover:border-green-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{product.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">{product.description}</p>
                      </div>
                      <span className="text-green-400 font-bold">¥{product.price}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>分类 ID: {product.category_id}</span>
                      <span>商品 ID: {product.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-[480px] p-4">
        <AttackConsole />
      </div>
    </div>
  );
};

export default Search;

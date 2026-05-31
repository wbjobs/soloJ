interface Column<T> {
  key: string;
  title: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="w-full overflow-hidden rounded-xl" style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-full rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl" style={{
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-t transition-colors hover:bg-white/5 cursor-pointer"
                style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Database, AlertCircle, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const defaultIcons: Record<string, LucideIcon> = {
  database: Database,
  error: AlertCircle,
};

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div
        className="max-w-sm w-full p-8 rounded-2xl text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="mb-4">
          <div
            className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            {icon || <Database className="w-8 h-8" style={{ color: 'var(--color-text-secondary)' }} />}
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

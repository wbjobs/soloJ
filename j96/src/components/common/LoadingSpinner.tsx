import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { container: 'w-6 h-6', icon: 'w-3 h-3' },
  md: { container: 'w-12 h-12', icon: 'w-6 h-6' },
  lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
};

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const config = sizeConfig[size];
  return (
    <div className="relative">
      <div
        className={`absolute inset-0 blur-xl rounded-full ${config.container}`}
        style={{
          background: 'conic-gradient(from 0deg, rgba(59, 130, 246, 0.4), rgba(139, 92, 246, 0.4), rgba(59, 130, 246, 0.4))',
          animation: 'spin 1.5s linear infinite',
        }}
      />
      <div
        className={`relative ${config.container} rounded-full flex items-center justify-center`}
        style={{
          background: 'rgba(17, 24, 39, 0.9)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <Loader2
          className={`${config.icon} text-blue-400`}
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

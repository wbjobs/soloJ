import { AlertTriangle, X, Bell, BellOff } from 'lucide-react';
import { useLogStore } from '../store/useLogStore';

export function AlertBanner() {
  const hasAlert = useLogStore((state) => state.hasAlert);
  const alertMessage = useLogStore((state) => state.alertMessage);
  const dismissAlert = useLogStore((state) => state.dismissAlert);
  const alertEnabled = useLogStore((state) => state.alertEnabled);
  const setAlertEnabled = useLogStore((state) => state.setAlertEnabled);

  if (!hasAlert || !alertMessage) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-red-500/90 backdrop-blur border border-red-400/50 rounded-lg shadow-2xl max-w-md">
        <div className="flex items-start gap-3 p-4">
          <div className="flex-shrink-0">
            <AlertTriangle size={24} className="text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm mb-1">
              High Error Rate Alert
            </h4>
            <p className="text-red-100 text-sm leading-relaxed">
              {alertMessage}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  setAlertEnabled(false);
                  dismissAlert();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-200 hover:text-white hover:bg-red-600/50 rounded transition-colors"
              >
                <BellOff size={12} />
                Disable Alerts
              </button>
            </div>
          </div>
          <button
            onClick={dismissAlert}
            className="flex-shrink-0 p-1 text-red-200 hover:text-white hover:bg-red-600/50 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

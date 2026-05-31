import { useRef, useState, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function TabSwitcher({ tabs, activeTab, onChange }: TabSwitcherProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!tabsRef.current) return;

    const activeElement = tabsRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeTab}"]`
    );

    if (activeElement) {
      const containerRect = tabsRef.current.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      setIndicatorStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      ref={tabsRef}
      className="relative inline-flex items-center gap-1 p-1 rounded-xl"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
        }}
      />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative z-10 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap"
            style={{
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: isActive
                      ? 'rgba(59, 130, 246, 0.4)'
                      : 'rgba(255, 255, 255, 0.1)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

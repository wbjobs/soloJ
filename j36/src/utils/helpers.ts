import type { StyleConfig } from '../types';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const getStateColor = (state: string): string => {
  const colors: Record<string, string> = {
    Pending: '#6b7280',
    Parsing: '#3b82f6',
    RemovingDrm: '#f59e0b',
    Rearranging: '#8b5cf6',
    Indexing: '#06b6d4',
    Completed: '#10b981',
    Failed: '#ef4444',
    Cancelled: '#9ca3af',
  };
  return colors[state] || '#6b7280';
};

export const getStateLabel = (state: string): string => {
  const labels: Record<string, string> = {
    Pending: '等待中',
    Parsing: '解析中',
    RemovingDrm: '移除DRM',
    Rearranging: '样式重排',
    Indexing: '建立索引',
    Completed: '已完成',
    Failed: '失败',
    Cancelled: '已取消',
  };
  return labels[state] || state;
};

export const getFormatIcon = (format: string): string => {
  const icons: Record<string, string> = {
    Pdf: '📄',
    Epub: '📖',
    Azw3: '📱',
    Mobi: '📱',
    Unknown: '📁',
  };
  return icons[format] || '📁';
};

export function createDefaultStyle(): StyleConfig {
  return {
    text: {
      fontFamily: 'Georgia, serif',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      textAlign: 'justify',
      lineHeight: 1.8,
      letterSpacing: 0,
      textIndent: 2,
    },
    layout: {
      pageWidth: 0,
      pageHeight: 0,
      marginTop: 40,
      marginBottom: 40,
      marginLeft: 50,
      marginRight: 50,
      backgroundColor: '#ffffff',
      columnCount: 1,
      columnGap: 20,
    },
    headingStyles: {
      h1: {
        fontFamily: 'Georgia, serif',
        fontSize: 28,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        textAlign: 'left',
        lineHeight: 1.4,
        letterSpacing: 0,
        textIndent: 0,
      },
      h2: {
        fontFamily: 'Georgia, serif',
        fontSize: 24,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        textAlign: 'left',
        lineHeight: 1.4,
        letterSpacing: 0,
        textIndent: 0,
      },
      h3: {
        fontFamily: 'Georgia, serif',
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        textAlign: 'left',
        lineHeight: 1.4,
        letterSpacing: 0,
        textIndent: 0,
      },
    },
    customCss: null,
  };
}

export const getDefaultStyle = createDefaultStyle;

export const createReaderStyle = (
  theme: 'light' | 'dark' | 'sepia' = 'light'
): StyleConfig => {
  const base = createDefaultStyle();
  
  switch (theme) {
    case 'dark':
      base.text.color = '#e0e0e0';
      base.layout.backgroundColor = '#1a1a1a';
      base.headingStyles.h1.color = '#ffffff';
      base.headingStyles.h2.color = '#ffffff';
      base.headingStyles.h3.color = '#ffffff';
      break;
    case 'sepia':
      base.text.color = '#5c4b37';
      base.layout.backgroundColor = '#f4ecd8';
      base.headingStyles.h1.color = '#3d2e1f';
      base.headingStyles.h2.color = '#3d2e1f';
      base.headingStyles.h3.color = '#3d2e1f';
      break;
  }
  
  return base;
};

export const fontFamilies = [
  { label: '衬线体', value: 'Georgia, serif' },
  { label: '无衬线体', value: 'Arial, sans-serif' },
  { label: '等宽体', value: 'Consolas, monospace' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
];

export const themes = [
  { label: '明亮', value: 'light', bg: '#ffffff', text: '#000000' },
  { label: '护眼', value: 'sepia', bg: '#f4ecd8', text: '#5c4b37' },
  { label: '夜间', value: 'dark', bg: '#1a1a1a', text: '#e0e0e0' },
];

export const textAligments = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
  { label: '两端对齐', value: 'justify' },
];

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

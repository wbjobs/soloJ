import { useState, useCallback, useEffect } from 'react';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  modified?: number;
}

export function useFileSystem() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadFileSystem();
  }, []);

  const loadFileSystem = useCallback(() => {
    try {
      const saved = localStorage.getItem('wasm_python_fs');
      if (saved) {
        setFiles(JSON.parse(saved));
      } else {
        const defaultFiles: FileNode[] = [
          {
            name: 'home',
            type: 'directory',
            children: [
              {
                name: 'user',
                type: 'directory',
                children: [
                  {
                    name: 'main.py',
                    type: 'file',
                    content: '# Welcome to WASM Python!',
                    modified: Date.now(),
                  },
                ],
              },
            ],
          },
          {
            name: 'tmp',
            type: 'directory',
            children: [],
          },
        ];
        setFiles(defaultFiles);
      }
      setIsReady(true);
    } catch (error) {
      console.error('Failed to load file system:', error);
      setIsReady(true);
    }
  }, []);

  const saveFileSystem = useCallback((newFiles: FileNode[]) => {
    try {
      localStorage.setItem('wasm_python_fs', JSON.stringify(newFiles));
    } catch (error) {
      console.error('Failed to save file system:', error);
    }
  }, []);

  const readFile = useCallback((path: string): string | null => {
    const parts = path.split('/').filter(p => p);
    let current: FileNode[] = files;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const found = current.find(f => f.name === parts[i]);
      if (!found || found.type !== 'directory') return null;
      current = found.children || [];
    }
    
    const fileName = parts[parts.length - 1];
    const file = current.find(f => f.name === fileName && f.type === 'file');
    return file?.content || null;
  }, [files]);

  const writeFile = useCallback((path: string, content: string) => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return false;

    const newFiles = JSON.parse(JSON.stringify(files));
    let current: FileNode[] = newFiles;

    for (let i = 0; i < parts.length - 1; i++) {
      let found = current.find(f => f.name === parts[i]);
      if (!found) {
        found = { name: parts[i], type: 'directory', children: [] };
        current.push(found);
      }
      if (found.type !== 'directory') return false;
      if (!found.children) found.children = [];
      current = found.children;
    }

    const fileName = parts[parts.length - 1];
    let file = current.find(f => f.name === fileName);
    if (!file) {
      file = { name: fileName, type: 'file', content: '' };
      current.push(file);
    }
    file.content = content;
    file.modified = Date.now();

    setFiles(newFiles);
    saveFileSystem(newFiles);
    return true;
  }, [files, saveFileSystem]);

  const createDirectory = useCallback((path: string) => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return false;

    const newFiles = JSON.parse(JSON.stringify(files));
    let current: FileNode[] = newFiles;

    for (let i = 0; i < parts.length; i++) {
      let found = current.find(f => f.name === parts[i]);
      if (!found) {
        found = { name: parts[i], type: 'directory', children: [] };
        current.push(found);
      }
      if (found.type !== 'directory') return false;
      if (!found.children) found.children = [];
      current = found.children;
    }

    setFiles(newFiles);
    saveFileSystem(newFiles);
    return true;
  }, [files, saveFileSystem]);

  const deleteFile = useCallback((path: string) => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return false;

    const newFiles = JSON.parse(JSON.stringify(files));
    let current: FileNode[] = newFiles;

    for (let i = 0; i < parts.length - 1; i++) {
      const found = current.find(f => f.name === parts[i]);
      if (!found || found.type !== 'directory') return false;
      current = found.children || [];
    }

    const fileName = parts[parts.length - 1];
    const index = current.findIndex(f => f.name === fileName);
    if (index === -1) return false;
    
    current.splice(index, 1);
    setFiles(newFiles);
    saveFileSystem(newFiles);
    return true;
  }, [files, saveFileSystem]);

  const listDirectory = useCallback((path: string): FileNode[] => {
    if (path === '/') return files;
    
    const parts = path.split('/').filter(p => p);
    let current: FileNode[] = files;

    for (const part of parts) {
      const found = current.find(f => f.name === part);
      if (!found || found.type !== 'directory') return [];
      current = found.children || [];
    }

    return current;
  }, [files]);

  return {
    files,
    currentPath,
    setCurrentPath,
    isReady,
    readFile,
    writeFile,
    createDirectory,
    deleteFile,
    listDirectory,
    loadFileSystem,
  };
}

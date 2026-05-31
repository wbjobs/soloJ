import { useEffect, useRef, useState } from 'react';

export function useImageLazyLoad() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Set<HTMLImageElement>>(new Set());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const img = entry.target as HTMLImageElement;
          if (entry.isIntersecting) {
            const dataSrc = img.getAttribute('data-src');
            if (dataSrc) {
              img.src = dataSrc;
              img.removeAttribute('data-src');
              img.classList.add('image-loaded');
            }
            observerRef.current?.unobserve(img);
            observedRef.current.delete(img);
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.01,
      }
    );

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedRef.current.clear();
    };
  }, []);

  const observe = (img: HTMLImageElement | null) => {
    if (!img || !observerRef.current) return;
    if (observedRef.current.has(img)) return;
    observedRef.current.add(img);
    observerRef.current.observe(img);
  };

  return { observe };
}

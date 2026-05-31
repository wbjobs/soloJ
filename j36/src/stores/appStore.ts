import { writable, derived } from 'svelte/store';
import type {
  AppState,
  ParsedBook,
  RearrangedBook,
  StyleConfig,
  BatchJob,
  SearchResult,
} from '../types';

function createAppStore() {
  const defaultStyle: StyleConfig = {
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

  const initialState: AppState = {
    currentView: 'library',
    selectedBook: null,
    rearrangedBook: null,
    styleConfig: defaultStyle,
    batchJobs: [],
    searchResults: null,
    searchQuery: '',
    isProcessing: false,
    error: null,
  };

  const { subscribe, set, update } = writable<AppState>(initialState);

  return {
    subscribe,
    set,
    update,
    
    setView: (view: AppState['currentView']) => {
      update(state => ({ ...state, currentView: view }));
    },
    
    setSelectedBook: (book: ParsedBook | null) => {
      update(state => ({ ...state, selectedBook: book, rearrangedBook: null }));
    },
    
    setRearrangedBook: (book: RearrangedBook | null) => {
      update(state => ({ ...state, rearrangedBook: book }));
    },
    
    updateStyleConfig: (config: Partial<StyleConfig>) => {
      update(state => ({
        ...state,
        styleConfig: {
          ...state.styleConfig,
          ...config,
          text: { ...state.styleConfig.text, ...config.text },
          layout: { ...state.styleConfig.layout, ...config.layout },
          headingStyles: { ...state.styleConfig.headingStyles, ...config.headingStyles },
        },
      }));
    },
    
    setStyleConfig: (config: StyleConfig) => {
      update(state => ({ ...state, styleConfig: config }));
    },
    
    addBatchJob: (job: BatchJob) => {
      update(state => ({
        ...state,
        batchJobs: [...state.batchJobs, job],
      }));
    },
    
    updateBatchJob: (jobId: string, updates: Partial<BatchJob>) => {
      update(state => ({
        ...state,
        batchJobs: state.batchJobs.map(job =>
          job.id === jobId ? { ...job, ...updates } : job
        ),
      }));
    },
    
    setSearchResults: (results: SearchResult | null) => {
      update(state => ({ ...state, searchResults: results }));
    },
    
    setSearchQuery: (query: string) => {
      update(state => ({ ...state, searchQuery: query }));
    },
    
    setProcessing: (processing: boolean) => {
      update(state => ({ ...state, isProcessing: processing }));
    },
    
    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },
    
    reset: () => {
      set(initialState);
    },
  };
}

export const appStore = createAppStore();

export const currentView = derived(appStore, $store => $store.currentView);
export const selectedBook = derived(appStore, $store => $store.selectedBook);
export const rearrangedBook = derived(appStore, $store => $store.rearrangedBook);
export const styleConfig = derived(appStore, $store => $store.styleConfig);
export const isProcessing = derived(appStore, $store => $store.isProcessing);
export const searchResults = derived(appStore, $store => $store.searchResults);

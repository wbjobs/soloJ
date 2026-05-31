import { FingerprintData } from '../wasm/fingerprint_wasm';

export interface StoreRequest {
    audio_id: string;
    fingerprints: FingerprintData[];
    duration: number;
    metadata?: Record<string, string>;
}

export interface MatchRequest {
    fingerprints: FingerprintData[];
}

export interface MatchResult {
    audio_id: string;
    score: number;
    matched_hashes: number;
    total_hashes: number;
    metadata?: Record<string, string>;
}

export interface StoreResponse {
    success: boolean;
    audio_id: string;
    fingerprint_count: number;
}

export interface MultiQuerySegment {
    segment_id: string;
    fingerprints: FingerprintData[];
    min_match_count?: number;
    weight?: number;
}

export interface MultiMatchRequest {
    segments: MultiQuerySegment[];
    mode?: 'intersection' | 'union';
}

export interface MultiMatchResult {
    audio_id: string;
    score: number;
    segment_scores: number[];
    segment_matches: number[];
    matched_hashes: number;
    total_hashes: number;
    metadata?: Record<string, string>;
}

const API_BASE = '/api';

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const resp = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    const contentType = resp.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return resp.json();
    }
    return resp.text() as unknown as T;
}

export const api = {
    storeFingerprints: (data: StoreRequest) =>
        request<StoreResponse>('/fingerprints', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    matchFingerprints: (data: MatchRequest) =>
        request<MatchResult[]>('/match', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAudioList: () =>
        request<{ audio_id: string; fingerprint_count: number; duration: number }[]>(
            '/audio'
        ),

    deleteAudio: (audioId: string) =>
        request<{ success: boolean }>(`/audio/${encodeURIComponent(audioId)}`, {
            method: 'DELETE',
        }),

    healthCheck: () =>
        request<{ status: string; fingerprint_count: number; audio_count: number; hash_index_count: number }>(
            '/health'
        ),

    matchMultiFingerprints: (data: MultiMatchRequest) =>
        request<MultiMatchResult[]>('/match-multi', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

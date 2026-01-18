// API client for Shpole backend
// In production, use relative URL (same origin). In dev, use localhost:3001
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

interface FetchOptions extends RequestInit {
    token?: string;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth
export const auth = {
    register: (email: string, password: string, username: string) =>
        fetchAPI<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, username })
        }),

    login: (email: string, password: string) =>
        fetchAPI<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }),

    setupUsername: (username: string, token: string) =>
        fetchAPI<{ user: User; token: string }>('/auth/setup-username', {
            method: 'POST',
            body: JSON.stringify({ username }),
            token
        }),

    me: (token: string) =>
        fetchAPI<{ user: User }>('/auth/me', { token })
};

// Moves
export const moves = {
    list: () =>
        fetchAPI<{ moves: Move[] }>('/moves'),

    get: (slug: string) =>
        fetchAPI<MoveDetail>(`/moves/${slug}`)
};

// Contributors
export const contributors = {
    get: (username: string) =>
        fetchAPI<ContributorProfile>(`/contributors/${username}`)
};

// Types
export interface User {
    id: number;
    email: string;
    username: string | null;
    created_at?: string;
}

export interface Move {
    Id: number;
    Slug: string;
    PdcName: string | null;
    PdcLevel: number | null;
    ShpoleLevel: number | null;
    StrengthReq: number | null;
    FlexibilityReq: number | null;
    TechniqueReq: number | null;
    MoveTypeName: string | null;
    AlsoKnownAs: string | null;
}

export interface MoveDetail {
    move: {
        Id: number;
        Slug: string;
        PdcName: string | null;
        PdcLevel: number | null;
        ShpoleLevel: number | null;
        IpsfCode: string | null;
        IpsfName: string | null;
        PosaCode: string | null;
        PosaName: string | null;
        StrengthReq: number | null;
        FlexibilityReq: number | null;
        TechniqueReq: number | null;
        Info: string | null;
        MoveTypeName: string | null;
    };
    names: Array<{
        MoveName: string;
        Source: string | null;
    }>;
    videos: Array<{
        Url: string;
        Credit: string | null;
        TimeStart: number | null;
        TimeEnd: number | null;
    }>;
    prerequisites: Array<{
        Slug: string;
        PdcName: string | null;
    }>;
    relatedMoves: Array<{
        Slug: string;
        PdcName: string | null;
        RelationType: string;
    }>;
    requirementDetails: Array<{
        Dimension: string;
        Level: number;
        Notes: string | null;
    }>;
}

export interface ContributorProfile {
    user: {
        username: string;
        createdDate: string;
    };
    stats: {
        movesContributed: number;
        namesContributed: number;
    };
}

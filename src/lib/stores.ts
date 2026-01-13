import { writable, derived } from 'svelte/store';
import type { User } from './api';

// Auth store
interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
}

function createAuthStore() {
    const { subscribe, set, update } = writable<AuthState>({
        user: null,
        token: null,
        isLoading: true
    });

    // Load from localStorage on init
    if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('shpole_token');
        const storedUser = localStorage.getItem('shpole_user');

        if (storedToken && storedUser) {
            try {
                set({
                    user: JSON.parse(storedUser),
                    token: storedToken,
                    isLoading: false
                });
            } catch {
                set({ user: null, token: null, isLoading: false });
            }
        } else {
            set({ user: null, token: null, isLoading: false });
        }
    }

    return {
        subscribe,
        login: (user: User, token: string) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('shpole_token', token);
                localStorage.setItem('shpole_user', JSON.stringify(user));
            }
            set({ user, token, isLoading: false });
        },
        logout: () => {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('shpole_token');
                localStorage.removeItem('shpole_user');
            }
            set({ user: null, token: null, isLoading: false });
        },
        updateUser: (user: User, token?: string) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('shpole_user', JSON.stringify(user));
                if (token) {
                    localStorage.setItem('shpole_token', token);
                }
            }
            update(state => ({
                ...state,
                user,
                token: token || state.token
            }));
        },
        setLoading: (isLoading: boolean) => {
            update(state => ({ ...state, isLoading }));
        }
    };
}

export const authStore = createAuthStore();

// Derived stores
export const isAuthenticated = derived(authStore, $auth => !!$auth.token);
export const currentUser = derived(authStore, $auth => $auth.user);
export const needsUsername = derived(authStore, $auth => $auth.user && !$auth.user.username);

// Theme store
function createThemeStore() {
    const { subscribe, set } = writable<'light' | 'dark'>('dark');

    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('shpole_theme') as 'light' | 'dark' | null;
        const initial = stored || 'dark'; // Default to dark theme
        set(initial);
        document.documentElement.classList.toggle('dark', initial === 'dark');
    }

    return {
        subscribe,
        toggle: () => {
            let currentTheme: 'light' | 'dark' = 'dark';
            const unsubscribe = subscribe(current => {
                currentTheme = current;
            });
            unsubscribe();
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            if (typeof window !== 'undefined') {
                localStorage.setItem('shpole_theme', newTheme);
                document.documentElement.classList.toggle('dark', newTheme === 'dark');
            }
            set(newTheme);
        },
        set: (theme: 'light' | 'dark') => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('shpole_theme', theme);
                document.documentElement.classList.toggle('dark', theme === 'dark');
            }
            set(theme);
        }
    };
}

export const themeStore = createThemeStore();

// Toast notification store
interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,
        show: (message: string, type: Toast['type'] = 'info') => {
            const id = Math.random().toString(36).slice(2);
            update(toasts => [...toasts, { id, message, type }]);

            setTimeout(() => {
                update(toasts => toasts.filter(t => t.id !== id));
            }, 4000);
        },
        dismiss: (id: string) => {
            update(toasts => toasts.filter(t => t.id !== id));
        }
    };
}

export const toastStore = createToastStore();

// Modal store for global modals
interface ModalState {
    isOpen: boolean;
    component: string | null;
    props: Record<string, unknown>;
}

function createModalStore() {
    const { subscribe, set } = writable<ModalState>({
        isOpen: false,
        component: null,
        props: {}
    });

    return {
        subscribe,
        open: (component: string, props: Record<string, unknown> = {}) => {
            set({ isOpen: true, component, props });
        },
        close: () => {
            set({ isOpen: false, component: null, props: {} });
        }
    };
}

export const modalStore = createModalStore();

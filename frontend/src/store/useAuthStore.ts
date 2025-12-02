// src/store/useAuthStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';

interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    setAuth: (token: string, user: User) => void;
    logout: () => void;
    initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,

    setAuth: (token, user) => {
        Cookies.set('sniphub_token', token, { expires: 7 });
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user });
    },

    logout: () => {
        Cookies.remove('sniphub_token');
        localStorage.removeItem('user');
        set({ token: null, user: null });
        window.location.href = '/login';
    },

    initialize: () => {
        const token = Cookies.get('sniphub_token');
        const userStr = localStorage.getItem('user');
        if (token && userStr) {
            set({ token, user: JSON.parse(userStr) });
        }
    }
}));

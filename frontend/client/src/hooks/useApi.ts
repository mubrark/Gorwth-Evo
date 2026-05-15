import { useAuth } from '../contexts/AuthContext';

export const useApi = () => {
    const { token } = useAuth();

    const authenticatedFetch = async (url: string, options?: RequestInit) => {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type' : 'application/json',
                ...(token ? { Authorization: `Bearer ${token}`} : {}),
                ...options?.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    };
    return { authenticatedFetch };
};
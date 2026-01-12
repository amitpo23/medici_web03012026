/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#e3f2fd',
                    100: '#bbdefb',
                    200: '#90caf9',
                    300: '#64b5f6',
                    400: '#42a5f5',
                    500: '#2196f3',
                    600: '#1e88e5',
                    700: '#1976d2',
                    800: '#1565c0',
                    900: '#0d47a1',
                },
                success: {
                    light: '#4caf50',
                    DEFAULT: '#2e7d32',
                    dark: '#1b5e20',
                },
                warning: {
                    light: '#ff9800',
                    DEFAULT: '#f57c00',
                    dark: '#e65100',
                },
                error: {
                    light: '#ef5350',
                    DEFAULT: '#d32f2f',
                    dark: '#c62828',
                },
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in',
                'slide-up': 'slideUp 0.5s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
            boxShadow: {
                'card': '0 2px 8px rgba(0, 0, 0, 0.1)',
                'card-hover': '0 4px 16px rgba(0, 0, 0, 0.15)',
                'xl-colored': '0 20px 25px -5px rgba(33, 150, 243, 0.1), 0 10px 10px -5px rgba(33, 150, 243, 0.04)',
            },
        },
    },
    plugins: [],
}
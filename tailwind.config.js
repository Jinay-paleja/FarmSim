/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          green: '#2D5016',
          'green-light': '#4A7C23',
          'green-pale': '#E8F5E0',
          brown: '#8B6914',
          'brown-light': '#C49A2A',
          'brown-pale': '#FDF6E3',
          soil: '#6B4423',
          sky: '#87CEEB',
          sun: '#FFD700',
          water: '#4A90D9',
          'water-light': '#B3D4FC',
          danger: '#DC2626',
          warning: '#F59E0B',
          success: '#16A34A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'grow': 'grow 2s ease-in-out infinite',
      },
      keyframes: {
        grow: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.05)' },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Clean light ops theme. Legacy token names kept to avoid churn.
        abyss: '#f1f4f7',
        'abyss-2': '#ffffff',
        shelf: '#ffffff',
        'shelf-2': '#ffffff',
        ice: '#111827',
        'ice-dim': '#4b5563',
        'ice-faint': '#8a94a6',
        cyan: '#1f3a5f',
        'cyan-soft': '#eef2f6',
        violet: '#4b5563',
        'violet-soft': '#f3f4f6',
        amber: '#92400e',
        coral: '#991b1b',
        mint: '#065f46',
        border: '#e3e8ef',
        'border-strong': '#cbd3df',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
      },
      boxShadow: {
        'glow': '0 1px 2px rgba(16,24,40,.06)',
        'cyan-glow': 'none',
        'coral-glow': 'none',
      },
    },
  },
  plugins: [],
}

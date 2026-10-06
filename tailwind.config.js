/** Тема перенесена из макетов Figma «Финансовый менеджер. Разработка» (узел 136:10). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00483c',
          light: '#167465',
          dark: '#072a24',
          muted: '#547d76',
          soft: '#dbf5f1',
        },
        surface: {
          DEFAULT: '#fff3ee',
          card: '#ffffff',
          muted: '#e8dfdb',
        },
        ink: {
          DEFAULT: '#000000',
          secondary: '#505050',
          muted: '#777777',
          placeholder: '#939393',
          inverse: '#ffffff',
        },
        sidebar: {
          text: '#d3dfdd',
          accent: '#86bdb4',
        },
        success: '#03b128',
        warning: '#d7a400',
        danger: '#bc2323',
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', 'sans-serif'],
        brand: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        caption: ['12px', { lineHeight: 'normal', letterSpacing: '0.36px' }],
        sm: ['14px', { lineHeight: 'normal', letterSpacing: '0.42px' }],
        base: ['16px', { lineHeight: 'normal', letterSpacing: '0.48px' }],
        lg: ['20px', { lineHeight: 'normal', letterSpacing: '0.6px' }],
        xl: ['24px', { lineHeight: 'normal' }],
        '2xl': ['32px', { lineHeight: 'normal', letterSpacing: '0.96px' }],
        '3xl': ['40px', { lineHeight: 'normal', letterSpacing: '1.2px' }],
        '4xl': ['48px', { lineHeight: 'normal', letterSpacing: '1.44px' }],
        '5xl': ['64px', { lineHeight: 'normal', letterSpacing: '1.92px' }],
      },
      borderRadius: {
        sm: '5px',
        md: '8px',
        DEFAULT: '10px',
      },
      height: {
        control: '50px',
      },
    },
  },
  plugins: [],
}

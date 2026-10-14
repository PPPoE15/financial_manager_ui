/** FM-55: Figma «Новый дизайн» (255:1431); источники и состояния — docs/design-theme.md. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './dev/**/*.{html,ts,vue}', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // FM-58: Главная, Rectangle 46 (230:465), непрозрачность задаётся карточкой.
        'budget-panel': '#010D17',
        // FM-55: совместимые имена для экранов, переносимых в FM-56…FM-60.
        primary: {
          DEFAULT: '#E5EAFF', light: '#FFFFFF', dark: '#1E2532',
          muted: '#CBD5E8', soft: '#2F3C53',
        },
        surface: { DEFAULT: '#4A5C7A', brand: '#2A3B53', card: '#1E2532', muted: '#2F3C53' },
        ink: {
          DEFAULT: '#FFFFFF', secondary: '#E5EAFF', muted: '#CBD5E8',
          placeholder: '#CBD5E8', inverse: '#1E2532',
        },
        action: {
          DEFAULT: '#8997B7', hover: '#A3B2D2', pressed: '#7D8CAB',
          foreground: '#1E2532', disabled: '#52617B', 'disabled-foreground': '#E5EAFF',
        },
        field: { DEFAULT: '#1E2532', hover: '#263246', border: '#8997B7' },
        focus: '#E5EAFF',
        sidebar: { text: '#1E2532', accent: '#8997B7' },
        success: '#A0FFAC', warning: '#FFE0A3', danger: '#FFD0D7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Involve', 'Inter', 'sans-serif'],
      },
      backgroundImage: { landscape: 'var(--fm-landscape)' },
      boxShadow: { panel: '0 16px 48px rgb(10 17 29 / 24%)' },
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
        sm: '3.75px',
        md: '8px',
        DEFAULT: '3.75px',
      },
      minHeight: { control: '37.5px' },
      height: {
        control: '37.5px',
      },
    },
  },
  plugins: [],
}

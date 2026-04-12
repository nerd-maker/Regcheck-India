import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sovereign Archive Design System — RegCheck-India
        'surface':                    '#f8f9fa',
        'surface-dim':                '#d9dadb',
        'surface-bright':             '#f8f9fa',
        'surface-container-lowest':   '#ffffff',
        'surface-container-low':      '#f3f4f5',
        'surface-container':          '#edeeef',
        'surface-container-high':     '#e7e8e9',
        'surface-container-highest':  '#e1e3e4',
        'surface-variant':            '#e1e3e4',
        'surface-tint':               '#435b9f',
        'on-surface':                 '#191c1d',
        'on-surface-variant':         '#444650',
        'inverse-surface':            '#2e3132',
        'inverse-on-surface':         '#f0f1f2',
        'background':                 '#f8f9fa',
        'on-background':              '#191c1d',
        'primary':                    '#00113a',
        'primary-container':          '#002366',
        'primary-fixed':              '#dbe1ff',
        'primary-fixed-dim':          '#b3c5ff',
        'on-primary':                 '#ffffff',
        'on-primary-container':       '#758dd5',
        'on-primary-fixed':           '#00174a',
        'on-primary-fixed-variant':   '#2a4386',
        'inverse-primary':            '#b3c5ff',
        'secondary':                  '#0059bb',
        'secondary-container':        '#0070ea',
        'secondary-fixed':            '#d8e2ff',
        'secondary-fixed-dim':        '#adc7ff',
        'on-secondary':               '#ffffff',
        'on-secondary-container':     '#fefcff',
        'on-secondary-fixed':         '#001a41',
        'on-secondary-fixed-variant': '#004493',
        'tertiary':                   '#00171b',
        'tertiary-container':         '#002d33',
        'tertiary-fixed':             '#9cf0ff',
        'tertiary-fixed-dim':         '#00daf3',
        'on-tertiary':                '#ffffff',
        'on-tertiary-container':      '#009eb0',
        'on-tertiary-fixed':          '#001f24',
        'on-tertiary-fixed-variant':  '#004f58',
        'error':                      '#ba1a1a',
        'error-container':            '#ffdad6',
        'on-error':                   '#ffffff',
        'on-error-container':         '#93000a',
        'outline':                    '#757682',
        'outline-variant':            '#c5c6d2',

        // Compliance status colors (preserved from previous config)
        'status-pass': '#10b981',
        'status-partial': '#f59e0b',
        'status-fail': '#ef4444',
        'status-unverified': '#6b7280',
        'status-na': '#9ca3af',

        // Risk level colors (preserved from previous config)
        'risk-high': '#dc2626',
        'risk-medium': '#f59e0b',
        'risk-low': '#10b981',
      },
      borderRadius: {
        'DEFAULT': '0.125rem',
        'sm':      '0.125rem',
        'md':      '0.375rem',
        'lg':      '0.5rem',
        'xl':      '0.75rem',
        '2xl':     '1rem',
        '3xl':     '1.5rem',
        'full':    '9999px',
      },
      fontFamily: {
        headline: ['Inter', 'sans-serif'],
        body:     ['Inter', 'sans-serif'],
        label:    ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'ambient': '0px 12px 32px rgba(25, 28, 29, 0.06)',
        'ambient-lg': '0px 24px 48px rgba(25, 28, 29, 0.10)',
      },
      animation: {
        'marquee': 'marquee 30s linear infinite',
        'float':   'float 4s ease-in-out infinite',
        'fadeInUp': 'fadeInUp 0.6s ease-out forwards',
        'scaleIn':  'scaleIn 0.5s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Display serifado com caracter (titulos) + corpo grotesco limpo.
        display: ['"Fraunces Variable"', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Archivo Variable"', 'Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ===== Tema "diario de viagem" =====
        // Os nomes (ocean/aqua/sand/dark) sao mantidos para nao quebrar as
        // classes ja usadas nas paginas; apenas os valores foram retematizados.

        // ocean = tinta marinha (cor primaria / acoes)
        ocean: {
          DEFAULT: '#1E4763',
          50: '#EDF2F6',
          100: '#D2DEE8',
          200: '#A7C0D0',
          300: '#6C92AB',
          400: '#3E6883',
          500: '#1E4763',
          600: '#163A52',
          700: '#112E41',
          800: '#0E2533',
          900: '#0A1A25',
        },
        // aqua = terracota / por-do-sol (acento quente, CTAs de destaque)
        aqua: {
          DEFAULT: '#BC5A2E',
          50: '#FAEEE7',
          100: '#F2D2C0',
          200: '#E8B196',
          300: '#DB8A63',
          400: '#CE6B3E',
          500: '#BC5A2E',
          600: '#9E4A24',
          700: '#7D3A1D',
          800: '#5E2C16',
          900: '#3F1D0F',
        },
        // sand = papel quente (fundos, superficies, bordas, texto suave)
        sand: {
          DEFAULT: '#F7F1E4',
          50: '#FFFFFF',
          100: '#F7F1E4',
          200: '#EFE7D5',
          300: '#E2D7BE',
          400: '#CBBC98',
          500: '#9A8C70',
          600: '#756A52',
        },
        // dark = tinta (textos e titulos)
        dark: {
          DEFAULT: '#1B2A38',
          50: '#52606B',
          100: '#3C4853',
          200: '#293742',
          300: '#1B2A38',
        }
      },
    },
  },
  plugins: [],
}

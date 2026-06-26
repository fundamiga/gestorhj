import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { 
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'ui-sans-serif', 'system-ui'],
      },
    } 
  },
  plugins: [],
};
export default config;

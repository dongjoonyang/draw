import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#f8f6f3",
        "ink-dark": "#e8e6e3",
        "paper-dark": "#121212",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
};
export default config;

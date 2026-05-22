import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        han: [
          "Noto Sans SC",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#1a1a1a",
        paper: "#fdfaf3",
        accent: "#c0392b",
        accent2: "#2c7da0",
      },
    },
  },
  plugins: [],
};
export default config;

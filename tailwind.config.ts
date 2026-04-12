import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0d131f",
        line: "#c8d4e5",
        canvas: "#edf2f7",
        accent: "#0c6c64",
        accentSoft: "#c2f7ec",
        brand: "#1a46c4",
        warn: "#a04906",
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#b0bec9",
          400: "#8091ab",
          500: "#55657c",
          600: "#3a4a63",
          700: "#2a374d",
          800: "#161f30",
          900: "#0a0f1f",
          950: "#020617",
        },
        // 深色商务蓝灰系主题颜色
        theme: {
          background: "#f0f4f8", // 稳定浅灰蓝
          card: "#ffffff", // 卡片白色
          cardMuted: "#f9fafb", // 微灰白
          heading: "#111827", // 深蓝黑
          body: "#2a374d", // 深 slate
          secondary: "#3a4a63", // 中灰但可读
          border: "#e2e8f0", // 清晰但不刺眼
          button: "#0d131f", // 深蓝黑/深炭色
          buttonHover: "#161f30", // 悬停更深
        },
        // 深墨绿物流行业系强调色
        intelligence: {
          accent: "#08544d", // 深墨绿
          accentLight: "#c2f7ec", // 浅青绿
          accentDark: "#063c36", // 更深墨绿
          highlight: "#0c6c64", // 原accent作为高亮
        },
        // 顶级颜色别名，方便使用
        "theme-background": "#f0f4f8",
        "theme-card": "#ffffff",
        "theme-card-muted": "#f9fafb",
        "theme-heading": "#111827",
        "theme-body": "#2a374d",
        "theme-secondary": "#3a4a63",
        "theme-border": "#e2e8f0",
        "theme-button": "#0d131f",
        "theme-button-hover": "#161f30",
        "intelligence-accent": "#08544d",
        "intelligence-accent-light": "#c2f7ec",
        "intelligence-accent-dark": "#063c36",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(15, 23, 42, 0.12)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;

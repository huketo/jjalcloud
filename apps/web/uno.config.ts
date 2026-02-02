import { defineConfig, presetIcons, presetUno } from "unocss";

export default defineConfig({
	presets: [
		presetUno(),
		presetIcons({
			scale: 1.2,
			cdn: "https://esm.sh/",
		}),
	],
	preflights: [
		{
			getCSS: () => `
        *, *::before, *::after {
          box-sizing: border-box;
        }
        input, textarea, select, button {
          font-family: inherit;
          font-size: inherit;
        }
      `,
		},
	],
	theme: {
		colors: {
			brand: {
				primary: "#4fb0e5", // Sky Blue
				"primary-dark": "#3fa0d5", // Slightly darker blue
				"primary-light": "#7fc8ee",
				"primary-pale": "#e8f4fc",
			},
			bg: {
				DEFAULT: "#f8fafc", // Very light off-white (Ice/Cloud feel)
				glass: "rgba(255, 255, 255, 0.60)", // More transparent "Clear Water" glass
				surface: "#ffffff",
				"surface-hover": "#f0f7fc",
			},
			text: {
				DEFAULT: "#1a2b3c", // Dark blue-grey
				secondary: "#5a6b7c",
				muted: "#8a9bac",
				inverse: "#ffffff",
			},
			border: {
				DEFAULT: "#d0e3f0",
				light: "#e8f0f5",
			},
			status: {
				like: "#ff6b8a",
				"like-active": "#ff4069",
				success: "#4ade80",
				error: "#ff6b6b",
				warning: "#ffb86c",
			},
		},
		// Custom shadows to match the "Clear/Ice" aesthetic
		boxShadow: {
			sm: "0 2px 8px rgba(79, 176, 229, 0.15)", // Light blue tint
			md: "0 4px 16px rgba(79, 176, 229, 0.20)", // Stronger blue tint
			lg: "0 8px 32px rgba(79, 176, 229, 0.25)",
			card: "0 2px 12px rgba(79, 176, 229, 0.12)",
		},
		fontFamily: {
			sans: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		},
		borderRadius: {
			sm: "8px",
			md: "12px",
			lg: "16px",
			xl: "24px", // Softer corners
			"2xl": "32px", // Extra soft
			full: "9999px",
		},
	},
});

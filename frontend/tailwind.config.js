/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  ...{
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "surface-dim": "#ead5d7",
                        "surface-tint": "#a93151",
                        "error": "#ba1a1a",
                        "secondary-fixed-dim": "#c6c6c7",
                        "tertiary-container": "#00562e",
                        "on-secondary": "#ffffff",
                        "surface-container": "#ffe9eb",
                        "on-tertiary-fixed": "#00210e",
                        "tertiary": "#003c1f",
                        "on-tertiary-container": "#81ca97",
                        "on-primary-fixed-variant": "#89173a",
                        "on-error": "#ffffff",
                        "secondary-container": "#dfe0e0",
                        "outline": "#8a7174",
                        "inverse-on-surface": "#ffecee",
                        "primary": "#6c0028",
                        "on-primary-fixed": "#400014",
                        "secondary-fixed": "#e2e2e2",
                        "error-container": "#ffdad6",
                        "on-background": "#24191a",
                        "on-secondary-container": "#616363",
                        "on-tertiary-fixed-variant": "#00522c",
                        "primary-fixed": "#ffd9de",
                        "on-tertiary": "#ffffff",
                        "surface-variant": "#f3dddf",
                        "secondary": "#5d5f5f",
                        "surface": "#fff8f7",
                        "inverse-surface": "#3a2d2f",
                        "tertiary-fixed": "#a8f3bd",
                        "on-surface-variant": "#574144",
                        "outline-variant": "#ddbfc3",
                        "on-surface": "#24191a",
                        "on-primary": "#ffffff",
                        "primary-fixed-dim": "#ffb2be",
                        "surface-bright": "#fff8f7",
                        "on-error-container": "#93000a",
                        "on-primary-container": "#ff9eaf",
                        "surface-container-lowest": "#ffffff",
                        "background": "#fff8f7",
                        "primary-container": "#8d1b3d",
                        "surface-container-high": "#f9e3e5",
                        "on-secondary-fixed-variant": "#454747",
                        "inverse-primary": "#ffb2be",
                        "surface-container-low": "#fff0f1",
                        "surface-container-highest": "#f3dddf",
                        "on-secondary-fixed": "#1a1c1c",
                        "tertiary-fixed-dim": "#8dd7a3"
                    },
                    borderRadius: {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "2xl": "1rem",
                        "3xl": "1.5rem",
                        "full": "9999px"
                    },
                    spacing: {
                        "sm": "8px",
                        "gutter": "24px",
                        "lg": "24px",
                        "margin-mobile": "16px",
                        "xl": "40px",
                        "container-max": "1280px",
                        "unit": "4px",
                        "xs": "4px",
                        "md": "16px"
                    },
                    fontFamily: {
                        "headline-md": ["Public Sans", "sans-serif"],
                        "label-sm": ["Public Sans", "sans-serif"],
                        "headline-xl": ["Public Sans", "sans-serif"],
                        "body-md": ["Public Sans", "sans-serif"],
                        "headline-lg": ["Public Sans", "sans-serif"],
                        "label-bold": ["Public Sans", "sans-serif"],
                        "body-lg": ["Public Sans", "sans-serif"]
                    },
                    fontSize: {
                        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
                        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
                        "headline-xl": ["40px", { lineHeight: "48px", fontWeight: "700" }],
                        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
                        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700" }],
                        "label-bold": ["14px", { lineHeight: "20px", fontWeight: "600" }],
                        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }]
                    }
                }
            }
        }
}

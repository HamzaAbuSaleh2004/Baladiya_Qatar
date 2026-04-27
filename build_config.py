import re

with open("frontend/src/raw/SmartCapture.html", "r", encoding="utf-8") as f:
    content = f.read()

config_match = re.search(r'tailwind\.config\s*=\s*(\{.*\})', content, re.DOTALL)
if config_match:
    config_str = config_match.group(1)
    # The config_str is JS object notation. To make it a proper JS module, just wrap it.
    
    tailwind_js = f"""/** @type {{import('tailwindcss').Config}} */
export default {{
  content: [
    "./index.html",
    "./src/**/*.{{js,ts,jsx,tsx}}",
  ],
  ...{config_str}
}}
"""
    with open("frontend/tailwind.config.js", "w", encoding="utf-8") as f:
        f.write(tailwind_js)
    print("Tailwind config written.")
else:
    print("No tailwind config found.")

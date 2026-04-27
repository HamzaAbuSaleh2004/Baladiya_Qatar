import os
import re

html_files = [f for f in os.listdir("frontend/src/raw") if f.endswith(".html")]

for html_file in html_files:
    path = os.path.join("frontend/src/raw", html_file)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
    if body_match:
        body_content = body_match.group(1)
    else:
        body_content = "<div>Error</div>"
    
    # Remove script and style tags completely
    body_content = re.sub(r'<script.*?</script>', '', body_content, flags=re.DOTALL | re.IGNORECASE)
    body_content = re.sub(r'<style.*?</style>', '', body_content, flags=re.DOTALL | re.IGNORECASE)
    
    body_content = body_content.replace('class=', 'className=')
    body_content = re.sub(r'<img([^>]*?)(?<!/)>', r'<img\1 />', body_content)
    body_content = re.sub(r'<input([^>]*?)(?<!/)>', r'<input\1 />', body_content)
    body_content = re.sub(r'<br([^>]*?)(?<!/)>', r'<br\1 />', body_content)
    body_content = re.sub(r'<hr([^>]*?)(?<!/)>', r'<hr\1 />', body_content)
    
    body_content = re.sub(r'style="([^"]*)"', '', body_content)
    body_content = re.sub(r'<!--(.*?)-->', r'{/*\1*/}', body_content, flags=re.DOTALL)
    
    component_name = html_file.replace(".html", "")
    
    jsx_code = f"""import React from 'react';

const {component_name} = () => {{
  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      {body_content}
    </div>
  );
}};

export default {component_name};
"""
    with open(f"frontend/src/pages/{component_name}.jsx", "w", encoding="utf-8") as f:
        f.write(jsx_code)

print("Created JSX files")

# Fix Tailwind config
with open("frontend/src/raw/SmartCapture.html", "r", encoding="utf-8") as f:
    html_content = f.read()

# Extract exactly between script id="tailwind-config" and </script>
config_script_match = re.search(r'<script id="tailwind-config">(.*?)</script>', html_content, re.DOTALL)
if config_script_match:
    script_text = config_script_match.group(1)
    # script_text contains: tailwind.config = { ... }
    # extract the object part
    obj_match = re.search(r'tailwind\.config\s*=\s*(\{.*\});?', script_text, re.DOTALL)
    if obj_match:
        config_obj = obj_match.group(1)
        tailwind_js = f"""/** @type {{import('tailwindcss').Config}} */
export default {{
  content: [
    "./index.html",
    "./src/**/*.{{js,ts,jsx,tsx}}",
  ],
  ...{config_obj}
}}
"""
        with open("frontend/tailwind.config.js", "w", encoding="utf-8") as f:
            f.write(tailwind_js)
        print("Tailwind config written.")

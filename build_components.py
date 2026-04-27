import os
import re

html_files = [f for f in os.listdir("frontend/src/raw") if f.endswith(".html")]

os.makedirs("frontend/src/pages", exist_ok=True)

for html_file in html_files:
    path = os.path.join("frontend/src/raw", html_file)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # extract body
    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
    if body_match:
        body_content = body_match.group(1)
    else:
        body_content = "<div>Error extracting body</div>"
    
    # replace class= with className=
    body_content = body_content.replace('class=', 'className=')
    # replace self-closing tags like <img ...> to <img ... />
    body_content = re.sub(r'<img([^>]*?)(?<!/)>', r'<img\1 />', body_content)
    body_content = re.sub(r'<input([^>]*?)(?<!/)>', r'<input\1 />', body_content)
    body_content = re.sub(r'<br([^>]*?)(?<!/)>', r'<br\1 />', body_content)
    body_content = re.sub(r'<hr([^>]*?)(?<!/)>', r'<hr\1 />', body_content)
    
    # For style="...", we need to convert to style={{...}}. Since doing it fully is complex, we just remove them or do simple regex.
    # Luckily Stitch HTML mostly uses tailwind and rarely inline styles, or simple ones.
    body_content = re.sub(r'style="([^"]*)"', '', body_content)
    
    # HTML comments
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

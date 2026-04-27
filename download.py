import urllib.request
import os

urls = {
    "SmartCapture.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1MDViZTc1ZmUyYTAwOTY4OGYxMjYyMTIwZjViEgsSBxC2q-avwx8YAZIBIwoKcHJvamVjdF9pZBIVQhM2NjI4NjcyODU1NjE2Mjk1OTQ3&filename=&opi=89354086",
    "Authentication.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1MDViZTc1ZmUyYTYwOTY4OGYxMjYyMTIwZjViEgsSBxC2q-avwx8YAZIBIwoKcHJvamVjdF9pZBIVQhM2NjI4NjcyODU1NjE2Mjk1OTQ3&filename=&opi=89354086",
    "AIAgentChat.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1MDViZTc1ZmUyYWMwOTY4OGYxMjYyMTIwZjViEgsSBxC2q-avwx8YAZIBIwoKcHJvamVjdF9pZBIVQhM2NjI4NjcyODU1NjE2Mjk1OTQ3&filename=&opi=89354086",
    "Confirmation.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1MDViZTc1ZmUyYjAwOTY4OGYxMjYyMTIwZjViEgsSBxC2q-avwx8YAZIBIwoKcHJvamVjdF9pZBIVQhM2NjI4NjcyODU1NjE2Mjk1OTQ3&filename=&opi=89354086",
    "Dashboard.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1MDViZTc1ZmUyYWUwOTY4OGYxMjYyMTIwZjViEgsSBxC2q-avwx8YAZIBIwoKcHJvamVjdF9pZBIVQhM2NjI4NjcyODU1NjE2Mjk1OTQ3&filename=&opi=89354086"
}

os.makedirs("frontend/src/raw", exist_ok=True)
for name, url in urls.items():
    print(f"Downloading {name}...")
    urllib.request.urlretrieve(url, f"frontend/src/raw/{name}")
print("Done.")

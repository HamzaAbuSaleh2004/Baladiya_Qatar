# Baladiya hazard model — Vertex AI playbook

End-to-end recipe for training a YOLOv8 fine-tune on your Roboflow `master-hazard`
dataset, registering it in **Vertex AI Model Registry**, and deploying it to a live
**Vertex AI Endpoint** that the agent backend calls before invoking Gemini.

> **Cost warning.** Vertex AI Endpoints bill **per minute** (~$0.05/hr on
> `n1-standard-2`, ~$36/month if left running). Training also costs ~$0.30 for one
> T4 run. Run **step 9 (teardown)** as soon as your demo is done.

---

## What your boss will see in the GCP Console

| Console area | What's there |
|---|---|
| **Vertex AI → Training → Custom jobs** | The training run, with logs and metrics. |
| **Cloud Storage → `<bucket>/models/v1/`** | `best.pt`, `best.onnx`, `results.csv`. |
| **Artifact Registry → `baladiya/`** | The trainer + server Docker images. |
| **Vertex AI → Model Registry → `baladiya-hazard-yolo`** | The registered model. |
| **Vertex AI → Online prediction → `baladiya-hazard`** | The live endpoint with a "Test & Use" tab where they can upload an image. |

---

## Prerequisites (one-time, on your laptop)

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) and Docker Desktop.
2. Run `gcloud init` and pick the GCP project you want to use. If you don't have one
   yet, create it from the [console](https://console.cloud.google.com/projectcreate).
3. Make sure billing is enabled on the project.
4. Get your Roboflow API key from <https://app.roboflow.com/settings/api>.

---

## Step 0 — Set environment variables (PowerShell)

> Run **all** PowerShell blocks in the same terminal session, or re-export these
> if you open a new one. Replace `your-project-id` and `your-rf-key` with real
> values. The bucket name must be globally unique — append your project id to
> stay safe.

```powershell
$env:PROJECT_ID  = "your-project-id"
$env:REGION      = "us-central1"
$env:BUCKET      = "$($env:PROJECT_ID)-baladiya"
$env:AR_REPO     = "baladiya"
$env:ROBOFLOW_API_KEY = "your-rf-key"

gcloud config set project $env:PROJECT_ID
gcloud config set ai/region $env:REGION
```

---

## Step 1 — Enable APIs and create infrastructure

```powershell
gcloud services enable `
  aiplatform.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  storage.googleapis.com

# A regional bucket holds the dataset and trained models.
gcloud storage buckets create "gs://$($env:BUCKET)" --location=$env:REGION

# Artifact Registry holds the Docker images for trainer + server.
gcloud artifacts repositories create $env:AR_REPO `
  --repository-format=docker `
  --location=$env:REGION `
  --description="Baladiya YOLO images"

# Let Docker push to Artifact Registry.
gcloud auth configure-docker "$($env:REGION)-docker.pkg.dev" --quiet
```

---

## Step 2 — Pull the dataset from Roboflow and upload to Cloud Storage

```powershell
# One-shot venv just for the Roboflow CLI.
python -m venv .rf-venv
.\.rf-venv\Scripts\Activate.ps1
pip install --quiet roboflow

# Download the YOLOv8-format dataset locally.
python -c @"
import os
from roboflow import Roboflow
rf = Roboflow(api_key=os.environ['ROBOFLOW_API_KEY'])
ds = rf.workspace('test-9rurm').project('master-hazard').version(1).download('yolov8', location='./dataset')
print('Downloaded to', ds.location)
"@

deactivate

# Upload the entire folder to GCS. Vertex training will mount it at /gcs/<bucket>/dataset/.
gcloud storage cp -r .\dataset "gs://$($env:BUCKET)/"
```

> **Sanity check:** in the GCP console open `gs://<bucket>/dataset/` and verify
> you see `data.yaml`, `train/`, `valid/`, `test/`.

The Roboflow `data.yaml` uses relative paths (`../train/images`). Vertex auto-mounts
GCS read-write at `/gcs/<bucket>/`, so the paths stay correct as long as the folder
structure is preserved (which `gcloud storage cp -r` does).

---

## Step 3 — Build and push the trainer image

```powershell
$TRAINER_IMAGE = "$($env:REGION)-docker.pkg.dev/$($env:PROJECT_ID)/$($env:AR_REPO)/yolo-train:v1"

# Use Cloud Build so we don't depend on the local Docker daemon for a multi-GB image.
gcloud builds submit ml/train --tag $TRAINER_IMAGE
```

This builds `ml/train/Dockerfile` (which extends `ultralytics/ultralytics`) and
pushes the image to Artifact Registry. First build takes ~5 min.

---

## Step 4 — Submit the Vertex AI custom training job

```powershell
# Render the training config from the template.
$cfg = Get-Content ml/vertex_train_config.yaml.template -Raw
$cfg = $cfg.Replace("__TRAINER_IMAGE__", $TRAINER_IMAGE).Replace("__BUCKET__", $env:BUCKET)
Set-Content ml/vertex_train_config.yaml $cfg

# Submit. This is what shows up in Vertex AI → Training → Custom jobs.
gcloud ai custom-jobs create `
  --region=$env:REGION `
  --display-name="baladiya-yolo-train-v1" `
  --config=ml/vertex_train_config.yaml
```

The command prints the job ID. Open
**Vertex AI → Training → Custom jobs** in the console and click the run to watch
logs in real time.

T4 + 50 epochs on the master-hazard dataset finishes in ~15–25 minutes.

When the job ends, the weights live at:
```
gs://<bucket>/models/v1/best.pt
gs://<bucket>/models/v1/best.onnx
gs://<bucket>/models/v1/results.csv
```

---

## Step 5 — Build and push the prediction server image

```powershell
$SERVER_IMAGE = "$($env:REGION)-docker.pkg.dev/$($env:PROJECT_ID)/$($env:AR_REPO)/yolo-serve:v1"

# Pull the trained weights down so they get baked into the serving image.
New-Item -ItemType Directory -Force ml/serve/model | Out-Null
gcloud storage cp "gs://$($env:BUCKET)/models/v1/best.pt" ml/serve/model/best.pt

gcloud builds submit ml/serve --tag $SERVER_IMAGE
```

---

## Step 6 — Register the model in Vertex AI Model Registry

```powershell
gcloud ai models upload `
  --region=$env:REGION `
  --display-name="baladiya-hazard-yolo" `
  --container-image-uri=$SERVER_IMAGE `
  --container-health-route="/health" `
  --container-predict-route="/predict" `
  --container-ports=8080

# Capture the new model ID.
$MODEL_ID = (gcloud ai models list --region=$env:REGION --filter="displayName=baladiya-hazard-yolo" --format="value(MODEL_ID)" | Select-Object -First 1)
Write-Host "MODEL_ID = $MODEL_ID"
```

The model now appears in **Vertex AI → Model Registry**.

---

## Step 7 — Create an endpoint and deploy the model to it

```powershell
# Create an endpoint shell.
gcloud ai endpoints create --region=$env:REGION --display-name="baladiya-hazard"

# Capture the endpoint ID.
$ENDPOINT_ID = (gcloud ai endpoints list --region=$env:REGION --filter="displayName=baladiya-hazard" --format="value(ENDPOINT_ID)" | Select-Object -First 1)
Write-Host "ENDPOINT_ID = $ENDPOINT_ID"

# Deploy the model. min-replica-count=1 is the smallest allowed; the cost meter
# starts here.
gcloud ai endpoints deploy-model $ENDPOINT_ID `
  --region=$env:REGION `
  --model=$MODEL_ID `
  --display-name="v1" `
  --machine-type="n1-standard-2" `
  --min-replica-count=1 `
  --max-replica-count=2 `
  --traffic-split=0=100
```

Deployment takes ~5–10 min. When it's green, open
**Vertex AI → Online prediction → baladiya-hazard → Test & Use** in the console;
your boss can paste a base64 JSON like
`{"instances":[{"image_b64":"<base64>"}]}` and see a live response.

---

## Step 8 — Point the agent at the endpoint

Add to `agent/.env`:

```
VERTEX_PROJECT=your-project-id
VERTEX_REGION=us-central1
VERTEX_ENDPOINT_ID=<ENDPOINT_ID from step 7>
```

Make sure the credentials gcloud uses can call Vertex (run
`gcloud auth application-default login` once if you haven't). Then restart the
backend (`python dev.py` from the project root). On the next photo upload you
should see in the backend log lines like:

```
[backend]  INFO:     127.0.0.1:... "POST /api/report/start HTTP/1.1" 200 OK
```

…and the agent's first reply will reference the YOLO classification (e.g.
"I see a pothole — confirmed by the vision model with 0.87 confidence.").

### Local testing without Vertex (cheap dev loop)

If you don't want to spin up Vertex while iterating on the app, run the same
serving container locally and point the backend at it:

```powershell
docker run --rm -p 8080:8080 $SERVER_IMAGE
# In agent/.env:
#   YOLO_SERVICE_URL=http://localhost:8080
```

`server/vision.py` prefers `VERTEX_ENDPOINT_ID` if set, otherwise falls back to
`YOLO_SERVICE_URL`, otherwise skips the YOLO step entirely (the app keeps
working, just without the hint).

---

## Step 9 — Teardown when the demo is over

```powershell
# Capture the deployed-model ID *inside* the endpoint.
$DEPLOYED_ID = (gcloud ai endpoints describe $ENDPOINT_ID --region=$env:REGION --format="value(deployedModels[0].id)")

# Undeploy first (this is what stops the per-minute charge).
gcloud ai endpoints undeploy-model $ENDPOINT_ID `
  --region=$env:REGION `
  --deployed-model-id=$DEPLOYED_ID

# Then delete the endpoint shell.
gcloud ai endpoints delete $ENDPOINT_ID --region=$env:REGION --quiet

# Optional: delete the model from the registry too.
gcloud ai models delete $MODEL_ID --region=$env:REGION --quiet
```

Bucket, Artifact Registry, and Cloud Storage objects survive — they cost cents
per month. Re-running step 7 redeploys cheaply (the image is cached).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `gcloud builds submit` fails with "permission denied on bucket" | The Cloud Build service account isn't allowed to push to AR. | `gcloud projects add-iam-policy-binding $env:PROJECT_ID --member="serviceAccount:$($env:PROJECT_ID)@cloudbuild.gserviceaccount.com" --role="roles/artifactregistry.writer"` |
| Custom training job stuck in PENDING | T4 quota = 0 in the region. | Switch to a region with quota or request quota at IAM → Quotas. |
| Endpoint deploy fails "model container did not start" | `best.pt` missing from the build context. | Re-run step 5 — make sure `ml/serve/model/best.pt` exists before the `gcloud builds submit`. |
| Backend logs `Vertex YOLO call failed: 403` | ADC creds don't have `aiplatform.user`. | Run `gcloud auth application-default login` and grant the role to your account. |

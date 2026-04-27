import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { startReport } from '../api';

const STAGES = [
  { key: 'analyzing', label: 'Analyzing image…' },
  { key: 'identifying', label: 'Identifying object…' },
  { key: 'drafting', label: 'Drafting report…' },
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function SmartCapture() {
  const navigate = useNavigate();
  const { token, report, setReport, resetReport } = useApp();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [imagePreview, setImagePreview] = useState(report.imagePreview);
  const [imageFile, setImageFile] = useState(report.image);
  const [gps, setGps] = useState(report.gps);
  const [gpsError, setGpsError] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState('');

  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not available in this browser.');
      return;
    }
    setGpsBusy(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsBusy(false);
      },
      (err) => {
        setGpsError(err.message || 'Unable to fetch location.');
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (gps) return;
    if (!('geolocation' in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        if (cancelled) return;
        setGpsError(err.message || 'Unable to fetch location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
    return () => { cancelled = true; };
  }, [gps]);

  useEffect(() => {
    if (!submitting) return;
    const timer = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 900);
    return () => clearInterval(timer);
  }, [submitting]);

  function onFilePicked(e) {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      setError('Image is too large (max 10 MB). Try a smaller photo.');
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const url = URL.createObjectURL(f);
    setImageFile(f);
    setImagePreview(url);
    setError('');
  }

  function discardPhoto() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  async function onSubmit() {
    if (!imageFile) { setError('Please capture or upload a photo.'); return; }
    if (!gps) { setError('Location is required. Allow location access and retry.'); return; }
    setError('');
    setStageIdx(0);
    setSubmitting(true);
    try {
      const res = await startReport({
        token,
        latitude: gps.latitude,
        longitude: gps.longitude,
        image: imageFile,
      });
      setReport({
        sessionId: res.session_id,
        image: imageFile,
        imagePreview,
        gps,
        messages: [
          { role: 'user', text: 'I want to report this issue.', image: imagePreview },
          { role: 'agent', text: res.reply },
        ],
        ticket: res.ticket || null,
      });
      navigate('/chat');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
      setStageIdx(0);
    }
  }

  function onCancel() {
    resetReport();
    navigate('/');
  }

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="flex items-center justify-between px-margin-mobile h-16 w-full z-10 bg-surface-bright/80 backdrop-blur-md sticky top-0 border-b border-outline-variant/40">
        <button
          onClick={onCancel}
          className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Cancel"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-label-bold text-label-bold text-on-surface">Smart Report</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Step 1 of 2</span>
        </div>
        <div className="w-11" />
      </header>

      <main className="flex-1 flex flex-col px-margin-mobile pb-gutter max-w-container-max mx-auto w-full relative">
        <div className="mt-xs mb-gutter text-center">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">Capture the Issue</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            Take a clear photo. Our AI will categorize it and ask one quick clarifying question.
          </p>
        </div>

        <div className="flex-1 relative rounded-3xl overflow-hidden bg-surface-container-highest shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col min-h-[280px]">
          {imagePreview ? (
            <img src={imagePreview} alt="Captured issue" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant px-md">
              <span className="material-symbols-outlined text-6xl opacity-70 mb-md">photo_camera</span>
              <p className="font-body-md text-body-md max-w-[16rem] text-center">
                Tap the camera button to take a photo, or upload from your gallery.
              </p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-sm">
            <button
              type="button"
              onClick={requestGps}
              disabled={gpsBusy}
              className="bg-inverse-surface/80 backdrop-blur-md text-inverse-on-surface text-label-sm font-label-sm px-3 py-1.5 rounded-full flex items-center gap-1 max-w-[70%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={gpsError ? 'Tap to retry location' : (gps ? 'Location' : 'Locating')}
              aria-label={gpsError ? 'Retry location' : 'Location status'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {gpsBusy ? 'progress_activity' : 'location_on'}
              </span>
              {gps ? (
                <span className="truncate">
                  {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
                </span>
              ) : gpsBusy ? (
                <span className="truncate">Locating…</span>
              ) : gpsError ? (
                <span className="truncate">Retry location</span>
              ) : (
                <span className="truncate">Locating…</span>
              )}
            </button>
            {imagePreview && (
              <button
                onClick={discardPhoto}
                className="w-11 h-11 rounded-full bg-inverse-surface/70 backdrop-blur-md flex items-center justify-center text-inverse-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Discard photo"
                aria-label="Discard photo"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
          </div>

          {submitting && (
            <div className="absolute inset-0 bg-inverse-surface/85 backdrop-blur-md flex flex-col items-center justify-center p-gutter z-10">
              <div className="relative w-20 h-20 mb-lg flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-inverse-on-surface/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <span className="material-symbols-outlined text-4xl text-inverse-on-surface icon-fill">smart_toy</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-inverse-on-surface mb-md text-center">
                AI Analysis in Progress
              </h2>
              <div className="flex flex-col gap-sm w-full max-w-xs">
                {STAGES.map((s, i) => (
                  <div key={s.key} className={`flex items-center gap-md ${i > stageIdx ? 'opacity-40' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      i < stageIdx ? 'bg-primary text-on-primary' :
                      i === stageIdx ? 'border-2 border-primary' : 'border-2 border-inverse-on-surface/30'
                    }`}>
                      {i < stageIdx && (
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      )}
                    </div>
                    <span className="font-body-md text-body-md text-inverse-on-surface">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(error || (gpsError && !gps)) && !submitting && (
          <p className="mt-md text-error font-label-bold text-label-bold text-center" role="alert">
            {error || gpsError}
          </p>
        )}

        <div className="pt-gutter flex items-center justify-between px-lg z-20">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="flex flex-col items-center gap-xs group disabled:opacity-50 focus-visible:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-surface-container-high group-focus-visible:ring-2 group-focus-visible:ring-primary transition-colors">
              <span className="material-symbols-outlined">photo_library</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Upload</span>
          </button>

          {imagePreview ? (
            <button
              onClick={onSubmit}
              disabled={submitting || !gps}
              className="bg-primary text-on-primary rounded-full px-8 py-4 flex items-center gap-2 shadow-[0_4px_10px_rgba(108,0,40,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined">send</span>
              <span className="font-label-bold text-label-bold">Analyze Issue</span>
            </button>
          ) : (
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={submitting}
              className="relative w-20 h-20 flex items-center justify-center group focus:outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary rounded-full"
              aria-label="Take photo"
            >
              <div className="absolute inset-0 rounded-full border-[4px] border-surface-variant" />
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_2px_8px_rgba(108,0,40,0.4)] group-active:scale-95 transition-transform">
                <span className="material-symbols-outlined icon-fill text-3xl">photo_camera</span>
              </div>
            </button>
          )}
          <div className="w-12" />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFilePicked}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFilePicked}
        />
      </main>
    </div>
  );
}

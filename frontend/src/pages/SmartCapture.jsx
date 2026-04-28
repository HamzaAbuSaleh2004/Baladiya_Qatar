import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { checkDuplicates, startReport } from '../api';
import { useI18n } from '../i18n';
import { resizeImage } from '../imageResize';
import { reverseGeocode } from '../maps';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const CATEGORY_LABEL = {
  pothole: 'Pothole / Road Damage',
  falling_tree: 'Tree Hazard',
};

export default function SmartCapture() {
  const navigate = useNavigate();
  const { token, setReport, resetReport } = useApp();
  const { t, lang } = useI18n();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Bug #4 fix: Always start fresh — the in-context Report state is reset on
  // mount, so a previous submitted ticket can never leak its image here.
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [gps, setGps] = useState(null);
  const [address, setAddress] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState(null);

  const STAGES = [
    { key: 'analyzing',   label: t('analyzing') },
    { key: 'identifying', label: t('identifying') },
    { key: 'drafting',    label: t('drafting') },
  ];

  // Reset persisted report on mount so we never re-show last submission's image.
  useEffect(() => {
    resetReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Reverse-geocode whenever GPS becomes available.
  useEffect(() => {
    if (!gps) return;
    let cancelled = false;
    reverseGeocode(gps.latitude, gps.longitude).then((s) => {
      if (cancelled) return;
      if (s) setAddress(s);
    });
    return () => { cancelled = true; };
  }, [gps]);

  useEffect(() => {
    if (!submitting) return;
    const timer = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 900);
    return () => clearInterval(timer);
  }, [submitting, STAGES.length]);

  function onFilePicked(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
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

  async function runStartReport() {
    setError('');
    setStageIdx(0);
    setSubmitting(true);
    try {
      const resized = await resizeImage(imageFile).catch(() => imageFile);
      const res = await startReport({
        token,
        latitude: gps.latitude,
        longitude: gps.longitude,
        image: resized,
        address,
        uiLanguage: lang,
      });
      setReport({
        sessionId: res.session_id,
        image: resized,
        imagePreview,
        gps,
        address,
        messages: [
          { role: 'user',  text: t('reportNewIssue'), image: imagePreview },
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

  async function onSubmit() {
    if (!imageFile) { setError(t('pickPhotoFirst')); return; }
    if (!gps)       { setError(t('locationRequired')); return; }
    setError('');

    try {
      const resizedForCheck = await resizeImage(imageFile).catch(() => imageFile);
      const dup = await checkDuplicates({
        token,
        latitude: gps.latitude,
        longitude: gps.longitude,
        image: resizedForCheck,
      });
      if (dup?.duplicates && dup.duplicates.length > 0) {
        setDuplicates({ items: dup.duplicates });
        return;
      }
    } catch {
      // Non-fatal — proceed.
    }

    runStartReport();
  }

  function continueDespiteDuplicate() {
    setDuplicates(null);
    runStartReport();
  }

  function cancelDuplicate() {
    setDuplicates(null);
    navigate('/');
  }

  function onCancel() {
    discardPhoto();
    resetReport();
    navigate('/');
  }

  return (
    <div
      className="min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased"
      style={{
        background:
          'radial-gradient(800px 400px at 50% -10%, #f8e9ef 0%, transparent 60%),' +
          'linear-gradient(180deg, #fffafb 0%, #fff7f8 100%)',
      }}
    >
      <header className="flex items-center justify-between px-margin-mobile h-16 w-full z-10 bg-surface-bright/80 backdrop-blur-md sticky top-0 border-b border-outline-variant/40">
        <button
          onClick={onCancel}
          className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Cancel"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-label-bold text-label-bold text-on-surface">{t('smartReport')}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{t('step1of2')}</span>
        </div>
        <div className="w-11" />
      </header>

      <main className="flex-1 flex flex-col px-margin-mobile pb-gutter max-w-container-max mx-auto w-full relative">
        <div className="mt-xs mb-gutter text-center">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">{t('captureTheIssue')}</h1>
          <p className="font-body-md text-on-surface-variant max-w-md mx-auto">{t('captureSubtitle')}</p>
        </div>

        <div className="flex-1 relative rounded-3xl overflow-hidden bg-surface-container-highest shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col min-h-[280px]">
          {imagePreview ? (
            <img src={imagePreview} alt="Captured issue" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant px-md">
              <span className="material-symbols-outlined text-6xl opacity-70 mb-md">photo_camera</span>
              <p className="font-body-md text-body-md max-w-[16rem] text-center">
                {t('captureSubtitle')}
              </p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-sm">
            <button
              type="button"
              onClick={requestGps}
              disabled={gpsBusy}
              className="bg-inverse-surface/80 backdrop-blur-md text-inverse-on-surface text-label-sm font-label-sm px-3 py-1.5 rounded-full flex items-center gap-1 max-w-[80%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={gpsError ? t('retryLocation') : (gps ? 'Location' : t('locating'))}
              aria-label={gpsError ? t('retryLocation') : 'Location status'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {gpsBusy ? 'progress_activity' : 'location_on'}
              </span>
              {address ? (
                <span className="truncate">{address}</span>
              ) : gps ? (
                <span className="truncate">{gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}</span>
              ) : gpsBusy ? (
                <span className="truncate">{t('locating')}</span>
              ) : gpsError ? (
                <span className="truncate">{t('retryLocation')}</span>
              ) : (
                <span className="truncate">{t('locating')}</span>
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
                {t('aiAnalysisInProgress')}
              </h2>
              <div className="flex flex-col gap-sm w-full max-w-xs">
                {STAGES.map((s, i) => (
                  <div key={s.key} className={`flex items-center gap-md ${i > stageIdx ? 'opacity-40' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      i < stageIdx ? 'bg-primary text-on-primary' :
                      i === stageIdx ? 'border-2 border-primary' : 'border-2 border-inverse-on-surface/30'
                    }`}>
                      {i < stageIdx && (<span className="material-symbols-outlined text-[14px] font-bold">check</span>)}
                    </div>
                    <span className="font-body-md text-inverse-on-surface">{s.label}</span>
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
            <span className="font-label-sm text-label-sm text-on-surface-variant">{t('upload')}</span>
          </button>

          {imagePreview ? (
            <button
              onClick={onSubmit}
              disabled={submitting || !gps}
              className="bg-primary text-on-primary rounded-full px-8 py-4 flex items-center gap-2 shadow-[0_4px_10px_rgba(108,0,40,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined">send</span>
              <span className="font-label-bold text-label-bold">{t('analyzeIssue')}</span>
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

        <input ref={fileInputRef}   type="file" accept="image/*" className="hidden" onChange={onFilePicked} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFilePicked} />
      </main>

      {duplicates && (
        <DuplicateModal items={duplicates.items} onContinue={continueDespiteDuplicate} onCancel={cancelDuplicate} />
      )}
    </div>
  );
}

function DuplicateModal({ items, onContinue, onCancel }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md p-lg flex flex-col gap-md">
        <div className="flex items-start gap-md">
          <div className="w-10 h-10 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">help</span>
          </div>
          <div>
            <h3 className="text-headline-md font-headline-md text-on-surface">{t('possibleDuplicate')}</h3>
            <p className="font-body-md text-on-surface-variant mt-1">{t('possibleDuplicateBody', items.length)}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-xs max-h-60 overflow-y-auto">
          {items.map((tk) => (
            <li key={tk.ticket_id} className="bg-surface-container rounded-lg p-sm">
              <div className="flex justify-between items-start gap-sm">
                <div className="min-w-0">
                  <div className="font-label-bold text-label-bold text-on-surface">#{tk.ticket_id}</div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant">
                    {CATEGORY_LABEL[tk.category] || tk.category} · {(tk.status || '').replace('_', ' ')}
                    {tk.distance_m != null ? ` · ~${Math.round(tk.distance_m)} m` : ''}
                  </div>
                </div>
                {tk.location?.latitude != null && (
                  <a
                    className="text-primary text-label-sm font-label-bold hover:underline shrink-0"
                    href={`https://www.google.com/maps?q=${tk.location.latitude},${tk.location.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    Map
                  </a>
                )}
              </div>
              {tk.description && (
                <p dir="auto" className="font-body-md text-on-surface mt-1 line-clamp-2">{tk.description}</p>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row-reverse gap-sm">
          <button type="button" onClick={onContinue} className="bg-primary text-on-primary px-lg py-3 rounded-full font-label-bold">
            {t('continueReport')}
          </button>
          <button type="button" onClick={onCancel} className="border border-outline text-on-surface px-lg py-3 rounded-full font-label-bold">
            {t('sameIssueCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

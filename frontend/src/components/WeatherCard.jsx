import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

// Doha, Qatar
const DOHA = { lat: 25.2854, lng: 51.5310 };

// Open-Meteo WMO weather codes (subset). Maps to icon + i18n key.
const WMO = {
  0:  { key: 'clearSky',    icon: 'wb_sunny' },
  1:  { key: 'mainlyClear', icon: 'wb_sunny' },
  2:  { key: 'partlyCloudy',icon: 'partly_cloudy_day' },
  3:  { key: 'overcast',    icon: 'cloud' },
  45: { key: 'foggy',       icon: 'foggy' },
  48: { key: 'foggy',       icon: 'foggy' },
  51: { key: 'drizzle',     icon: 'rainy' },
  53: { key: 'drizzle',     icon: 'rainy' },
  55: { key: 'drizzle',     icon: 'rainy' },
  61: { key: 'rain',        icon: 'rainy' },
  63: { key: 'rain',        icon: 'rainy' },
  65: { key: 'rain',        icon: 'rainy' },
  80: { key: 'showers',     icon: 'rainy_heavy' },
  81: { key: 'showers',     icon: 'rainy_heavy' },
  82: { key: 'showers',     icon: 'rainy_heavy' },
  71: { key: 'snow',        icon: 'cloudy_snowing' },
  73: { key: 'snow',        icon: 'cloudy_snowing' },
  75: { key: 'snow',        icon: 'cloudy_snowing' },
  95: { key: 'thunderstorm',icon: 'thunderstorm' },
  96: { key: 'thunderstorm',icon: 'thunderstorm' },
  99: { key: 'thunderstorm',icon: 'thunderstorm' },
};

export default function WeatherCard({ city = 'Doha' }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState({ loading: true, error: false, data: null });

  useEffect(() => {
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DOHA.lat}&longitude=${DOHA.lng}&current=temperature_2m,weather_code&timezone=auto`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const cur = j?.current || {};
        if (typeof cur.temperature_2m !== 'number') {
          setState({ loading: false, error: true, data: null });
          return;
        }
        setState({
          loading: false,
          error: false,
          data: { temp: Math.round(cur.temperature_2m), code: cur.weather_code },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, error: true, data: null });
      });
    return () => { cancelled = true; };
  }, []);

  const wmo = WMO[state.data?.code] || { key: 'clearSky', icon: 'wb_sunny' };
  const cityLabel = lang === 'ar' && city === 'Doha' ? 'الدوحة' : city;

  return (
    <div className="bg-surface-container/80 backdrop-blur-sm border border-outline-variant rounded-2xl px-md py-sm flex items-center gap-md">
      <div className="w-11 h-11 rounded-full bg-amber-100/60 flex items-center justify-center text-amber-600 shrink-0">
        <span className="material-symbols-outlined icon-fill text-2xl">{wmo.icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        {state.loading ? (
          <span className="font-label-sm text-on-surface-variant">{t('weatherLoading')}</span>
        ) : state.error ? (
          <span className="font-label-sm text-on-surface-variant">{t('weatherError')}</span>
        ) : (
          <>
            <span className="font-label-bold text-label-bold text-on-surface">
              {cityLabel}, {state.data.temp}°C
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {t(wmo.key)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

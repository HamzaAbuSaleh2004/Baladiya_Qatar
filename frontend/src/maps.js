// Google Maps loader + reverse geocoding helpers.
//
// The bootstrap <script> in index.html exposes window.google.maps.importLibrary.
// We wrap it so callers can `await loadMaps('marker', 'visualization')` etc.

const _libraries = new Map();

export async function loadMapsLibrary(name) {
  if (_libraries.has(name)) return _libraries.get(name);
  if (!window.google?.maps?.importLibrary) {
    // Loader script may not have run yet; poll briefly.
    await new Promise((resolve, reject) => {
      const start = Date.now();
      const id = setInterval(() => {
        if (window.google?.maps?.importLibrary) { clearInterval(id); resolve(); }
        else if (Date.now() - start > 8000) { clearInterval(id); reject(new Error('Google Maps failed to load')); }
      }, 80);
    });
  }
  const lib = await window.google.maps.importLibrary(name);
  _libraries.set(name, lib);
  return lib;
}

// Reverse-geocode a (lat, lng) to a short postal-style address.
// Returns the first formatted_address from the Geocoding service. Errors are
// non-fatal — caller should fall back to coordinates.
export async function reverseGeocode(lat, lng) {
  try {
    const { Geocoder } = await loadMapsLibrary('geocoding');
    const geocoder = new Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    if (!results || results.length === 0) return '';
    // Prefer a "route" (street) result, else the first one.
    const route = results.find((r) => r.types?.includes('route'));
    return (route || results[0]).formatted_address || '';
  } catch {
    return '';
  }
}

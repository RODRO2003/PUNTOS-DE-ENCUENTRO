(function (root) {
  "use strict";
  // Umbrales de software orientativos, no reglas aprobadas de seguridad minera.
  const MAX_AGE_MS = 60000;
  const MAX_ACCURACY_M = 100;
  const MAX_PROXIMITY_M = 5000;
  function validPoint(point) {
    return point && typeof point.id === "string" && /^[0-9]{1,3}[A-Z]?$/.test(point.id) &&
      typeof point.reference === "string" && point.reference.trim().length > 0 &&
      Array.isArray(point.areas) && point.areas.length > 0 &&
      point.areas.every((area) => typeof area === "string" && area.trim()) &&
      Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
      Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 &&
      typeof point.latDms === "string" && typeof point.lngDms === "string" &&
      Number.isInteger(point.page) && point.page > 0 &&
      /^maps\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(point.image);
  }
  function validCatalog(points) {
    return Array.isArray(points) && points.length > 0 &&
      points.every(validPoint) && new Set(points.map((p) => p.id)).size === points.length;
  }
  function distance(a, b) {
    // Formula de Haversine: distancia sobre una esfera, sin caminos ni desniveles.
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return (
      6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
    );
  }
  function assess(position, points, now = Date.now()) {
    // Validar antes de ordenar evita presentar una lectura invalida como destino.
    if (
      !position ||
      !Number.isFinite(position.lat) ||
      !Number.isFinite(position.lng) ||
      Math.abs(position.lat) > 90 ||
      Math.abs(position.lng) > 180 ||
      !Number.isFinite(position.accuracy) ||
      position.accuracy < 0 ||
      !Number.isFinite(position.timestamp)
    )
      return { status: "invalid", ranked: [] };
    if (
      now - position.timestamp > MAX_AGE_MS ||
      position.timestamp - now > 5000
    )
      return { status: "stale", ranked: [] };
    if (position.accuracy > MAX_ACCURACY_M)
      return { status: "inaccurate", ranked: [] };
    if (!validCatalog(points)) return { status: "empty", ranked: [] };
    const ranked = points
      .map((point) => ({ point, distance: distance(position, point) }))
      .sort((a, b) => a.distance - b.distance);
    if (!ranked.length) return { status: "empty", ranked: [] };
    if (ranked[0].distance > MAX_PROXIMITY_M) return { status: "far", ranked };
    const ambiguous =
      ranked.length > 1 &&
      ranked[1].distance - ranked[0].distance <= 2 * position.accuracy;
    return { status: "ok", ranked, ambiguous };
  }
  const api = { distance, assess, validCatalog, MAX_AGE_MS, MAX_ACCURACY_M, MAX_PROXIMITY_M };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MeetingGeo = api;
})(typeof window === "undefined" ? {} : window);

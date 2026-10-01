(function () {
  "use strict";
  // La interfaz usa el catalogo de points.js y los calculos puros de geo.js.
  const $ = (id) => document.getElementById(id);
  const points = window.MEETING_POINTS || [];
  const geo = window.MeetingGeo;
  if (!geo || !geo.validCatalog(points)) {
    $("network-notice").hidden = false;
    $("network-notice").textContent = "No se pudo cargar el catalogo de puntos. Consulta el documento original y comunica el error al administrador.";
    ["evacuate", "visualize", "locate"].forEach((id) => { $(id).disabled = true; });
    return;
  }
  document.querySelector(".count").textContent = points.length;
  const state = {
    mode: "home",
    map: null,
    tiles: null,
    selected: null,
    position: null,
    watch: null,
    request: 0,
    tracking: false,
    authorized: false,
    permission: null,
    pageActive: true,
    ageTimer: null,
    centered: false,
    result: null,
    userMarker: null,
    accuracyCircle: null,
  };
  const markers = new Map();
  const number = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const icon = (name) =>
    '<i data-lucide="' + name + '" aria-hidden="true"></i>';
  const icons = () => {
    if (window.lucide)
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  };
  function formatDistance(meters) {
    return meters < 1000
      ? number.format(Math.round(meters / 10) * 10) + " m"
      : number.format(meters / 1000) + " km";
  }
  function renderList() {
    const focusedPoint =
      document.activeElement?.closest("[data-point]")?.dataset.point;
    const distances = new Map(
      (state.result?.status === "ok" ? state.result.ranked : []).map((r) => [
        r.point.id,
        r.distance,
      ]),
    );
    $("points-list").innerHTML = points
      .map(
        (point) =>
          '<button type="button" class="point-row" data-point="' +
          escape(point.id) +
          '" aria-pressed="' +
          (state.selected === point.id) +
          '" aria-label="Ver punto de encuentro ' +
          escape(point.id) +
          '"><span class="point-badge">' +
          escape(point.id) +
          '</span><span class="point-row-text"><strong>' +
          escape(point.reference) +
          "</strong><small>PE " +
          escape(point.id) +
          " &middot; " +
          (distances.has(point.id)
            ? "~ " +
              formatDistance(distances.get(point.id)) +
              " en l\u00ednea recta"
            : "P\u00e1gina " + point.page + " del Anexo 05") +
          "</small></span>" +
          icon("chevron-right") +
          "</button>",
      )
      .join("");
    icons();
    if (focusedPoint)
      document
        .querySelector('[data-point="' + focusedPoint + '"]')
        ?.focus({ preventScroll: true });
  }
  function markerIcon(point) {
    return L.divIcon({
      className:
        "pe-marker" + (state.selected === point.id ? " is-selected" : ""),
      html: "<span>" + escape(point.id) + "</span>",
      iconSize: [40, 32],
      iconAnchor: [20, 16],
    });
  }
  function initializeMap() {
    if (state.map) {
      state.map.invalidateSize();
      return;
    }
    if (!window.L) {
      $("map").innerHTML =
        '<p class="map-unavailable">No se pudo cargar el mapa. Consulta los puntos y sus fichas en la lista.</p>';
      $("fit-points").disabled = true;
      return;
    }
    state.map = L.map("map", {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 19,
    });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => state.map.invalidateSize({ pan: false }));
      observer.observe($("map"));
    }
    state.map.attributionControl.setPrefix(false);
    state.map.zoomControl.setPosition("topleft");
    const zoomIn = document.querySelector(".leaflet-control-zoom-in");
    const zoomOut = document.querySelector(".leaflet-control-zoom-out");
    zoomIn?.setAttribute("aria-label", "Acercar mapa");
    zoomIn?.setAttribute("title", "Acercar mapa");
    zoomOut?.setAttribute("aria-label", "Alejar mapa");
    zoomOut?.setAttribute("title", "Alejar mapa");
    // Las teselas del fondo son externas; los puntos y las fichas son locales.
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        keepBuffer: 1,
        attribution:
          'Im\u00e1genes: <a href="https://goto.arcgisonline.com/maps/World_Imagery" target="_blank" rel="noopener">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
      },
    );
    const streets = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        keepBuffer: 1,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
    );
    state.tiles = satellite;
    // Cada fondo conserva sus propios errores al cambiar de capa.
    [satellite, streets].forEach((layer) => {
      const failed = new Set();
      let loaded = 0;
      let loadTimer;
      const key = (e) => [e.coords.z, e.coords.x, e.coords.y].join("/");
      const updateNotice = () => {
        if (state.tiles === layer) $("tile-notice").hidden = failed.size === 0;
      };
      layer.on("add", () => {
        state.tiles = layer;
        updateNotice();
      });
      layer.on("loading", () => {
        clearTimeout(loadTimer);
        loaded = 0;
        loadTimer = setTimeout(() => {
          if (state.tiles === layer && !loaded && state.mode !== "home")
            $("tile-notice").hidden = false;
        }, 15000);
      });
      layer.on("tileerror", (e) => {
        failed.add(key(e));
        updateNotice();
      });
      layer.on("tileload", (e) => {
        loaded++;
        failed.delete(key(e));
        updateNotice();
      });
      layer.on("tileunload", (e) => {
        failed.delete(key(e));
        updateNotice();
      });
      layer.on("remove", () => {
        clearTimeout(loadTimer);
        failed.clear();
      });
    });
    satellite.addTo(state.map);
    const basemaps = L.control.layers(
      { "Sat\u00e9lite": satellite, "Mapa": streets },
      null,
      { position: "topright" },
    ).addTo(state.map);
    const layerToggle = basemaps.getContainer().querySelector(".leaflet-control-layers-toggle");
    layerToggle?.setAttribute("title", "Cambiar entre sat\u00e9lite y mapa");
    layerToggle?.setAttribute("aria-label", "Cambiar entre sat\u00e9lite y mapa");
    state.map.on("baselayerchange", (event) => {
      state.tiles = event.layer;
      basemaps.collapse();
    });
    points.forEach((point) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: markerIcon(point),
        title: "PE " + point.id + ": " + point.reference,
        alt: "Punto de encuentro " + point.id,
        keyboard: true,
      });
      marker.bindTooltip(
        "PE " + escape(point.id) + " &middot; " + escape(point.reference),
        { direction: "top", offset: [0, -15] },
      );
      marker.on("click", () => selectPoint(point.id, true));
      marker.addTo(state.map);
      markers.set(point.id, marker);
    });
    L.control
      .scale({ imperial: false, position: "bottomleft" })
      .addTo(state.map);
    fitAll();
  }
  function fitAll() {
    if (state.map && points.length)
      state.map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [40, 40], maxZoom: 14, animate: false },
      );
  }
  function highlightPoint(id) {
    const old = state.selected;
    state.selected = id;
    [old, id].filter(Boolean).forEach((key) => {
      const point = points.find((p) => p.id === key);
      if (point && markers.has(key)) {
        markers.get(key).setIcon(markerIcon(point));
        markers.get(key).setZIndexOffset(key === id ? 1000 : 0);
      }
    });
    document
      .querySelectorAll("[data-point]")
      .forEach((row) =>
        row.setAttribute(
          "aria-pressed",
          row.dataset.point === id ? "true" : "false",
        ),
      );
  }
  function selectPoint(id, reveal) {
    const point = points.find((p) => p.id === id);
    if (!point) return;
    highlightPoint(id);
    const mapUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(point.lat.toFixed(7) + "," + point.lng.toFixed(7));
    $("point-detail").hidden = false;
    $("point-detail").innerHTML =
      '<div class="detail-heading"><h2 tabindex="-1" id="detail-title">Punto ' +
      escape(point.id) +
      '</h2><button class="icon-button" id="close-detail" type="button" title="Cerrar ficha" aria-label="Cerrar ficha">' +
      icon("x") +
      '</button></div><p class="detail-reference">' +
      escape(point.reference) +
      '</p><h3>\u00c1reas de influencia</h3><ul class="areas">' +
      point.areas.map((area) => "<li>" + escape(area) + "</li>").join("") +
      '</ul><h3>Coordenadas del documento</h3><p class="coordinates">' +
      escape(point.latDms) +
      " &middot; " +
      escape(point.lngDms) +
      "<br>" +
      point.lat.toFixed(7) +
      ", " +
      point.lng.toFixed(7) +
      '</p><figure><a href="' +
      escape(point.image) +
      '" target="_blank" rel="noopener" aria-label="Ampliar imagen de referencia del punto ' +
      escape(point.id) +
      '"><img src="' +
      escape(point.image) +
      '" alt="Vista de referencia del PE ' +
      escape(point.id) +
      " extra\u00edda del Anexo 05, p\u00e1gina " +
      point.page +
      '" loading="lazy"></a><figcaption>Imagen del documento, p\u00e1gina ' +
      point.page +
      '. No es una vista en tiempo real.</figcaption></figure><div class="detail-links"><a href="' +
      mapUrl +
      '" target="_blank" rel="noopener">' +
      icon("external-link") +
      'Ver punto en Google Maps</a><a href="anexo-05.pdf#page=' +
      point.page +
      '" target="_blank" rel="noopener">' +
      icon("file-text") +
      'Ver ficha original</a></div><p class="detail-note">La coordenada identifica un encuentro con equipos de emergencia. No acredita una zona segura ni una ruta autorizada.</p>';
    $("close-detail").onclick = () => {
      $("point-detail").hidden = true;
      highlightPoint(null);
      const target = $("points-list").hidden
        ? $("points-toggle")
        : document.querySelector('[data-point="' + point.id + '"]');
      target?.focus({ preventScroll: true });
    };
    icons();
    if (state.map)
      state.map.setView([point.lat, point.lng], 17, { animate: false });
    if (reveal) {
      if (window.matchMedia("(max-width:1100px)").matches)
        $("point-detail").scrollIntoView({ block: "start", behavior: "auto" });
      else
        document.querySelector(".side-panel").scrollTop =
          $("point-detail").offsetTop -
          document.querySelector(".side-panel").offsetTop;
      $("detail-title").focus({ preventScroll: true });
    }
  }
  function locationStatus(title, message, options = {}) {
    const visible = !!(options.error || options.loading || options.retry);
    $("location-notice").hidden = !visible;
    $("location-notice").textContent = visible ? title + ". " + message : "";
    $("locate").setAttribute("aria-busy", String(!!options.loading));
  }
  function removeUserMarker() {
    if (state.map) {
      if (state.userMarker) state.map.removeLayer(state.userMarker);
      if (state.accuracyCircle) state.map.removeLayer(state.accuracyCircle);
    }
    state.userMarker = null;
    state.accuracyCircle = null;
    $("user-legend").hidden = true;
  }
  function updateUserMarker(position, inaccurate) {
    if (!state.map) return;
    const location = [position.lat, position.lng];
    const marker = L.divIcon({
      className: "",
      html:
        '<div class="user-dot' + (inaccurate ? " uncertain" : "") + '"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (!state.userMarker) {
      state.userMarker = L.marker(location, {
        icon: marker,
        zIndexOffset: 2000,
        title: "Ubicaci\u00f3n reportada por tu dispositivo",
      }).addTo(state.map);
      state.accuracyCircle = L.circle(location, {
        radius: position.accuracy,
        weight: 1,
        color: "#216acb",
        fillColor: "#216acb",
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(state.map);
    } else {
      state.userMarker.setLatLng(location).setIcon(marker);
      state.accuracyCircle.setLatLng(location).setRadius(position.accuracy);
    }
    $("user-legend").hidden = false;
  }
  function clearResult() {
    $("nearest").hidden = true;
    $("nearest").innerHTML = "";
    state.result = null;
    renderList();
    requestAnimationFrame(() => state.map?.invalidateSize());
  }
  function renderNearest(result) {
    if (state.mode !== "evacuate" || result.status !== "ok") {
      $("nearest").hidden = true;
      return;
    }
    const { point, distance } = result.ranked[0];
    $("nearest").hidden = false;
    $("nearest").innerHTML =
      '<div class="nearest-heading"><h2>PE ' +
      escape(point.id) +
      '</h2><span class="nearest-distance">~ ' +
      formatDistance(distance) +
      '</span></div><div class="nearest-info"><p class="nearest-reference">' +
      escape(point.reference) +
      '</p><p class="nearest-caption">En l\u00ednea recta, no por camino</p>' +
      '<button type="button" id="nearest-detail" class="small-button">Ver ubicaci\u00f3n y referencia</button></div>';
    $("nearest-detail").onclick = () => selectPoint(point.id, true);
    requestAnimationFrame(() => state.map?.invalidateSize());
  }
  function applyPosition(position) {
    state.position = position;
    const result = geo.assess(position, points);
    state.result = result;
    if (result.status === "invalid" || result.status === "stale") {
      clearResult();
      removeUserMarker();
      locationStatus(
        "Ubicaci\u00f3n no disponible",
        "La lectura no es reciente o no es v\u00e1lida. No se calcular\u00e1 un punto cercano hasta obtener una ubicaci\u00f3n actual.",
        { error: true, retry: true },
      );
      return;
    }
    updateUserMarker(position, result.status === "inaccurate");
    if (result.status === "inaccurate") {
      clearResult();
      locationStatus(
        "Ubicaci\u00f3n poco precisa",
        "El margen reportado es de " +
          Math.ceil(position.accuracy) +
          " m. No se selecciona un punto cercano con un margen superior a 100 m. Consulta las fichas o vuelve a intentar.",
        { error: true, retry: true },
      );
    } else if (result.status === "far") {
      $("nearest").hidden = true;
      requestAnimationFrame(() => state.map?.invalidateSize());
      locationStatus(
        "Lejos de los puntos registrados",
        "El punto registrado m\u00e1s pr\u00f3ximo est\u00e1 a " +
          formatDistance(result.ranked[0].distance) +
          ". A m\u00e1s de 5 km no se realiza una selecci\u00f3n autom\u00e1tica. Esto no define el l\u00edmite de la mina.",
        { error: true, retry: true },
      );
    } else if (result.status === "empty") {
      locationStatus(
        "Sin puntos disponibles",
        "No se pudo cargar el cat\u00e1logo. Consulta el documento original.",
        { error: true },
      );
    } else {
      locationStatus(
        "Ubicaci\u00f3n actual",
        result.ambiguous && state.mode === "evacuate"
          ? "La precision GPS no permite distinguir con certeza entre los puntos mas cercanos. Confirma el punto con la brigada."
          : state.mode === "evacuate"
          ? "Consulta de proximidad actualizada. No se ha enviado ninguna alerta."
          : "Tu ubicaci\u00f3n aparece en azul en el mapa.",
        { error: result.ambiguous && state.mode === "evacuate" },
      );
      renderNearest(result);
      if (!state.centered && state.map) {
        const coords = [[position.lat, position.lng]];
        if (state.mode === "evacuate")
          coords.push([result.ranked[0].point.lat, result.ranked[0].point.lng]);
        if (coords.length === 2)
          state.map.fitBounds(coords, {
            padding: [60, 60],
            maxZoom: 17,
            animate: false,
          });
        else state.map.setView(coords[0], 16, { animate: false });
        state.centered = true;
      }
    }
    renderList();
  }
  function stopTracking(clear = true) {
    state.request++;
    if (state.watch !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(state.watch);
    state.watch = null;
    state.tracking = false;
    if (state.ageTimer !== null) clearInterval(state.ageTimer);
    state.ageTimer = null;
    $("locate").setAttribute("aria-busy", "false");
    if (clear) {
      state.position = null;
      clearResult();
      removeUserMarker();
    }
  }
  function locationError(error) {
    if (error.code !== 1) {
      if (state.position && Date.now() - state.position.timestamp > geo.MAX_AGE_MS) {
        state.position = null;
        clearResult();
        removeUserMarker();
      }
      locationStatus(
        "Esperando ubicaci\u00f3n",
        state.tracking
          ? "La se\u00f1al no est\u00e1 disponible. Se reanudar\u00e1 al recuperarla."
          : "Pulsa el bot\u00f3n de ubicaci\u00f3n para reintentar.",
        { error: true },
      );
      return;
    }
    state.authorized = false;
    stopTracking();
    const messages = {
      1: "El navegador no tiene permiso para acceder a tu ubicaci\u00f3n. Puedes habilitarlo en los permisos del sitio y reintentar. Las fichas siguen disponibles.",
      2: "El dispositivo no pudo determinar tu ubicaci\u00f3n. No se seleccion\u00f3 ning\u00fan punto. Consulta las fichas y coordina con la brigada.",
      3: "No se obtuvo una ubicaci\u00f3n a tiempo. No se seleccion\u00f3 ning\u00fan punto. Puedes reintentar o consultar las fichas.",
    };
    if (error.code === 1 && location.protocol === "file:") {
      messages[1] =
        "El navegador deneg\u00f3 la ubicaci\u00f3n o no la permite en archivos locales. Revisa sus permisos. Puedes consultar las fichas sin GPS; no se ha seleccionado un punto cercano.";
    }
    locationStatus(
      error.code === 1
        ? "Permiso de ubicaci\u00f3n denegado"
        : "No se pudo obtener tu ubicaci\u00f3n",
      messages[error.code] || messages[2],
      { error: true, retry: true },
    );
    $("locate").disabled = false;
  }
  function startLocation() {
    state.centered = false;
    if (state.tracking) {
      if (state.position) applyPosition(state.position);
      return;
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      const message =
        location.protocol === "file:"
          ? "Este navegador no ofrece ubicaci\u00f3n al abrir este archivo local. Puedes consultar el mapa y las fichas sin GPS. El c\u00f3digo no puede cambiar esa restricci\u00f3n."
          : "Abre el enlace HTTPS en un navegador con acceso a ubicaci\u00f3n. Puedes consultar todos los puntos sin activar la ubicaci\u00f3n.";
      locationStatus("Ubicaci\u00f3n no compatible", message, {
        error: true,
        retry: true,
      });
      return;
    }
    state.tracking = true;
    const request = ++state.request;
    locationStatus(
      "Buscando tu ubicaci\u00f3n",
      "Permite el acceso a la ubicaci\u00f3n cuando lo solicite el navegador. El c\u00e1lculo se realiza en este dispositivo.",
      { loading: true },
    );
    try {
      state.watch = navigator.geolocation.watchPosition(
        (result) => {
          if (request !== state.request || !state.tracking) return;
          state.authorized = true;
          applyPosition({
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
            timestamp: result.timestamp,
          });
        },
        (error) => {
          if (request === state.request) locationError(error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    } catch {
      stopTracking(false);
      locationError({ code: 2 });
      return;
    }
    state.ageTimer = setInterval(() => {
      if (
        state.position &&
        Date.now() - state.position.timestamp > geo.MAX_AGE_MS
      ) {
        state.position = null;
        clearResult();
        removeUserMarker();
        state.centered = false;
        locationStatus(
          "Ubicaci\u00f3n desactualizada",
          "Pas\u00f3 m\u00e1s de un minuto sin una lectura nueva. Se ha retirado el resultado cercano hasta recuperar la ubicaci\u00f3n.",
          { error: true, retry: true },
        );
      }
    }, 5000);
  }
  async function resumeGrantedLocation() {
    if (!state.authorized && !state.tracking) return;
    if (!state.pageActive || document.hidden || !window.isSecureContext || !navigator.geolocation) return;
    if (state.position) applyPosition(state.position);
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (!state.permission) {
          state.permission = permission;
          permission.onchange = () => {
            if (permission.state === "granted") {
              state.authorized = true;
              if (state.pageActive && !document.hidden && !state.tracking) startLocation();
            } else {
              state.authorized = false;
              stopTracking();
              locationStatus("Permiso de ubicaci\u00f3n no disponible", "Act\u00edvalo desde el navegador para volver a consultar tu punto cercano.", { error: true });
            }
          };
        }
        if (permission.state === "granted" && state.pageActive && !document.hidden && !state.tracking) {
          state.authorized = true;
          startLocation();
        }
        return;
      } catch {
        // Algunos navegadores no permiten consultar este permiso.
      }
    }
    if (state.pageActive && !document.hidden && state.authorized && !state.tracking) startLocation();
  }
  function setView(mode) {
    state.mode = mode;
    document.body.classList.toggle("evacuation-view", mode === "evacuate");
    document.body.classList.toggle("map-view", mode !== "home");
    $("header-actions").hidden = mode === "home";
    $("home").hidden = mode !== "home";
    $("workspace").hidden = mode === "home";
    if (mode === "home") {
      $("point-detail").hidden = true;
      highlightPoint(null);
      window.scrollTo(0, 0);
      return;
    }
    renderList();
    initializeMap();
    if (state.position) applyPosition(state.position);
    else if (state.result) renderNearest(state.result);
    if (mode === "evacuate" && !state.tracking)
      locationStatus(
        "Ubicaci\u00f3n necesaria",
        "Activa Mi ubicaci\u00f3n para consultar el punto m\u00e1s cercano. La web no env\u00eda alertas a emergencias.",
        { retry: true },
      );
    requestAnimationFrame(() => state.map?.invalidateSize());
    window.scrollTo(0, 0);
  }
  function navigate(mode) {
    const hash =
      mode === "evacuate"
        ? "#punto-encuentro"
        : mode === "map"
          ? "#mapa"
          : "#inicio";
    if (location.hash !== hash) {
      // Cambiar solo el fragmento evita restricciones de pushState en file://.
      if (location.protocol === "file:") location.hash = hash;
      else history.pushState(null, "", hash);
    }
    setView(mode);
    if (mode !== "home") $("workspace").focus({ preventScroll: true });
  }
  function route() {
    const mode =
      location.hash === "#mapa"
        ? "map"
        : location.hash === "#punto-encuentro"
          ? "evacuate"
          : "home";
    // navigate ya actualiza la vista; un hashchange posterior no borra avisos GPS.
    if (mode !== state.mode) setView(mode);
  }
  $("visualize").onclick = () => navigate("map");
  $("evacuate").onclick = () => {
    navigate("evacuate");
    startLocation();
  };
  $("locate").onclick = startLocation;
  $("fit-points").onclick = fitAll;
  $("retry-tiles").onclick = () => {
    if (state.tiles) state.tiles.redraw();
  };
  $("points-toggle").onclick = () => {
    const list = $("points-list");
    const expanded = $("points-toggle").getAttribute("aria-expanded") === "true";
    $("points-toggle").setAttribute("aria-expanded", String(!expanded));
    list.hidden = expanded;
  };
  $("points-list").onclick = (event) => {
    const button = event.target.closest("[data-point]");
    if (button) selectPoint(button.dataset.point, true);
  };
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
  window.addEventListener("pagehide", () => {
    state.pageActive = false;
    stopTracking(false);
  });
  window.addEventListener("pageshow", (event) => {
    state.pageActive = true;
    if (event.persisted) resumeGrantedLocation();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resumeGrantedLocation();
  });
  const network = () => {
    $("network-notice").hidden = navigator.onLine;
    if (navigator.onLine) state.tiles?.redraw();
  };
  window.addEventListener("online", network);
  window.addEventListener("offline", network);
  $("network-notice").hidden = navigator.onLine;
  icons();
  route();
  resumeGrantedLocation();
})();

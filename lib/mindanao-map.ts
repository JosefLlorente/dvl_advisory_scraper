import L from "leaflet";

export const MINDANAO_CENTER: L.LatLngExpression = [7.7, 125.0];
export const MINDANAO_BOUNDS = L.latLngBounds([5.35, 121.85], [10.25, 126.65]);
export const MINDANAO_MIN_ZOOM = 7;
export const MINDANAO_MAX_ZOOM = 15;
export const MINDANAO_DEFAULT_ZOOM = 8;

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const CACHE_NAME = "dvl-osm-mindanao-v1";

function tileXY(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      n,
  );
  return { x, y };
}

export function prefetchMindanaoTiles() {
  const southWest = MINDANAO_BOUNDS.getSouthWest();
  const northEast = MINDANAO_BOUNDS.getNorthEast();
  const zoom = MINDANAO_DEFAULT_ZOOM;
  const min = tileXY(northEast.lat, southWest.lng, zoom);
  const max = tileXY(southWest.lat, northEast.lng, zoom);
  const subs = ["a", "b", "c"];

  for (let x = min.x; x <= max.x; x += 1) {
    for (let y = min.y; y <= max.y; y += 1) {
      const url = TILE_URL.replace("{s}", subs[(x + y) % 3])
        .replace("{z}", String(zoom))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
      const image = new Image();
      image.referrerPolicy = "no-referrer";
      image.src = url;
      if (typeof caches !== "undefined") {
        void caches.open(CACHE_NAME).then(async (cache) => {
          if (await cache.match(url)) {
            return;
          }
          try {
            const response = await fetch(url, {
              mode: "no-cors",
              credentials: "omit",
            });
            await cache.put(url, response);
          } catch {
            // img prefetch still warms the HTTP cache
          }
        });
      }
    }
  }
}

export function addMindanaoTiles(map: L.Map) {
  const layer = L.tileLayer(TILE_URL, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    keepBuffer: 6,
    updateWhenIdle: true,
    updateWhenZooming: false,
    maxZoom: MINDANAO_MAX_ZOOM,
  });
  layer.addTo(map);
  prefetchMindanaoTiles();
  return layer;
}

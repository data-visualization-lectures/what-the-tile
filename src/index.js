const maplibregl = require('maplibre-gl');
const tilebelt = require('@mapbox/tilebelt');
const tc = require('@mapbox/tile-cover');

const DEFAULT_CENTER = [138, 36];
const DEFAULT_ZOOM = 1;

const initialView = getInitialViewFromURL();

var map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  center: initialView.center,
  zoom: initialView.zoom,
  maxZoom: 18
});

// Simple Nominatim-based geocoder control
class SimpleGeocoder {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.cssText = 'position: relative; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); display: flex; align-items: center;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search places...';
    input.style.cssText = 'width: 200px; padding: 5px; border: 1px solid #ccc; border-radius: 3px;';

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.search(input.value);
      }
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Search';
    button.style.cssText = 'margin-left: 6px; padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; background: #f5f5f5; cursor: pointer; width: auto; height: auto; text-indent: 0; background-image: none;';
    button.addEventListener('click', () => {
      this.search(input.value);
    });

    this.container.appendChild(input);
    this.container.appendChild(button);
    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
    this.map = undefined;
  }

  search(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          const result = data[0];
          this.map.flyTo({
            center: [parseFloat(result.lon), parseFloat(result.lat)],
            zoom: 12
          });
        }
      })
      .catch(err => console.error('Geocoding error:', err));
  }
}

// Style options for map switcher
const styleOptions = [
  { name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { name: 'Positron Light', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { name: 'Positron Nolabels', url: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json' },
  { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { name: 'Mapterhorn', id: 'mapterhorn' },
  { name: 'GSI 標準地図', id: 'gsi-std' },
  { name: 'GSI 淡色地図', id: 'gsi-pale' },
  { name: 'GSI 写真', id: 'gsi-photo' }
];

// Load external style JSON from file
async function loadExternalStyle(styleId) {
  try {
    const response = await fetch(`./styles/${styleId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${styleId} style: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`Error loading ${styleId} style:`, err);
    // Fallback to Voyager style if loading fails
    return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
  }
}

// Legacy function for backward compatibility
async function getMapterhornStyle() {
  return loadExternalStyle('mapterhorn');
}

// Map style switcher control
class StyleSwitcher {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.cssText = 'display: flex; gap: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1);';

    const select = document.createElement('select');
    select.style.cssText = 'padding: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px;';

    styleOptions.forEach((style) => {
      const option = document.createElement('option');
      option.value = style.id || style.url;
      option.textContent = style.name;
      if (style.name === 'Voyager') option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', async (e) => {
      const selectedStyle = styleOptions.find(s => (s.id || s.url) === e.target.value);

      if (selectedStyle && selectedStyle.id) {
        // Load external style JSON file
        const externalStyle = await loadExternalStyle(selectedStyle.id);
        this.map.setStyle(externalStyle);
      } else {
        // Use URL-based styles
        this.map.setStyle(selectedStyle.url);
      }

      this.map.once('style.load', () => {
        initializeTileLayers();
      });

      this.map.once('load', () => {
        initializeTileLayers();
      });

      // Fallback: setTimeout as last resort
      setTimeout(() => {
        if (this.map.isStyleLoaded()) {
          initializeTileLayers();
        }
      }, 1000);
    });

    this.container.appendChild(select);
    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
    this.map = undefined;
  }
}

// Tile info toggle control
class TileToggleControl {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.cssText = 'display: flex; align-items: center; gap: 6px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1);';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'tile-info-toggle';
    checkbox.checked = true;
    checkbox.style.cssText = 'cursor: pointer; margin: 0; width: 16px; height: 16px;';

    const label = document.createElement('label');
    label.htmlFor = 'tile-info-toggle';
    label.textContent = 'タイル情報';
    label.style.cssText = 'cursor: pointer; margin: 0; font-size: 12px; user-select: none;';

    checkbox.addEventListener('change', (e) => {
      const visibility = e.target.checked ? 'visible' : 'none';
      if (this.map.getLayer('tiles')) this.map.setLayoutProperty('tiles', 'visibility', visibility);
      if (this.map.getLayer('tiles-shade')) this.map.setLayoutProperty('tiles-shade', 'visibility', visibility);
      if (this.map.getLayer('tiles-centers')) this.map.setLayoutProperty('tiles-centers', 'visibility', visibility);
    });

    this.container.appendChild(checkbox);
    this.container.appendChild(label);
    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
    this.map = undefined;
  }
}

map.addControl(new SimpleGeocoder(), 'top-left');
map.addControl(new StyleSwitcher(), 'top-left');
map.addControl(new TileToggleControl(), 'top-left');
map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

// Initialize tile sources and layers
function initializeTileLayers() {
  // Remove existing sources and layers if they exist
  if (map.getLayer('tiles-centers')) map.removeLayer('tiles-centers');
  if (map.getLayer('tiles-shade')) map.removeLayer('tiles-shade');
  if (map.getLayer('tiles')) map.removeLayer('tiles');

  if (map.getSource('tiles-centers-geojson')) map.removeSource('tiles-centers-geojson');
  if (map.getSource('tiles-geojson')) map.removeSource('tiles-geojson');

  map.addSource('tiles-geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addSource('tiles-centers-geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  // Add tile grid layers
  map.addLayer({
    id: 'tiles',
    source: 'tiles-geojson',
    type: 'line',
    paint: {
      'line-color': '#000',
      'line-width': 1
    }
  });

  map.addLayer({
    id: 'tiles-shade',
    source: 'tiles-geojson',
    type: 'fill',
    paint: {
      'fill-color': ['case', ['get', 'even'], 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0)']
    }
  });

  map.addLayer({
    id: 'tiles-centers',
    source: 'tiles-centers-geojson',
    type: 'symbol',
    layout: {
      'text-field': ['format', ['get', 'text'], { 'font-scale': 1.2 }],
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': '#000',
      'text-color-transition': {
        duration: 0
      },
      'text-halo-color': '#fff',
      'text-halo-width': 0.5
    }
  });

  update();
}

map.on('load', () => {
  initializeTileLayers();
  updateUrlWithMapState();
});

map.on('moveend', update);
map.on('moveend', updateUrlWithMapState);

map.on('click', (e) => {
  if (!map.getLayer('tiles-shade')) {
    return;
  }
  features = map.queryRenderedFeatures(e.point, {layers: ['tiles-shade']});
  if (features && features.length > 0) {
    const infoText = features[0].properties.infoText || `Quadkey:\n${features[0].properties.quadkey}`;
    copyToClipboard(infoText)
    showSnackbar()
  }
})

function update() {
  updateTiles();
}

function updateUrlWithMapState() {
  if (typeof window === 'undefined' || !window.history || !window.location || typeof map === 'undefined') {
    return;
  }

  const center = map.getCenter();
  const zoom = map.getZoom();
  const params = new URLSearchParams(window.location.search);
  params.set('lat', center.lat.toFixed(5));
  params.set('lon', center.lng.toFixed(5));
  params.set('zoom', zoom.toFixed(2));

  const query = params.toString();
  const hash = window.location.hash || '';
  const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
  window.history.replaceState({}, '', newUrl);
}

function updateTiles() {
  var extentsGeom = getExtentsGeom();
  var zoom = Math.ceil(map.getZoom());
  tiles = tc.tiles(extentsGeom, {min_zoom: zoom, max_zoom: zoom});

  var tileFeatures = tiles.map(getTileFeature);

  map.getSource('tiles-geojson').setData({
    type: 'FeatureCollection',
    features: tileFeatures
  });

  var tileCenterFeatures = tiles.map(getTileCenterFeature);

  map.getSource('tiles-centers-geojson').setData({
    type: 'FeatureCollection',
    features: tileCenterFeatures
  });
}

function getInitialViewFromURL() {
  if (typeof window === 'undefined' || !window.location) {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }

  const params = new URLSearchParams(window.location.search);
  const zoomParam = parseFloat(params.get('zoom'));
  const latParam = parseFloat(params.get('lat'));
  const lonParam = parseFloat(params.get('lon'));

  const hasLatLon = Number.isFinite(latParam) && Number.isFinite(lonParam);
  const center = hasLatLon ? [lonParam, latParam] : DEFAULT_CENTER;
  const zoom = Number.isFinite(zoomParam) ? zoomParam : DEFAULT_ZOOM;

  return { center, zoom };
}

function getExtentsGeom() {
  var e = map.getBounds();
  var box = [
    e.getSouthWest().toArray(),
    e.getNorthWest().toArray(),
    e.getNorthEast().toArray(),
    e.getSouthEast().toArray(),
    e.getSouthWest().toArray()
  ].map(coords => {
    if (coords[0] < -180) return [-179.99999, coords[1]]
    if (coords[0] > 180) return [179.99999, coords[1]]
    return coords
  });

  return {
    type: 'Polygon',
    coordinates: [box]
  };
}

function getTileFeature(tile) {
  var quadkey = tilebelt.tileToQuadkey(tile);
  var infoText = formatTileInfo(tile);

  var feature = {
    type: 'Feature',
    properties: {
      even: ((tile[0] + tile[1]) % 2 == 0),
      quadkey: quadkey,
      infoText: infoText
    },
    geometry: tilebelt.tileToGeoJSON(tile)
  };
  return feature;
}

function getTileCenterFeature(tile) {
  var box = tilebelt.tileToBBOX(tile);
  var center = [
    (box[0] + box[2]) / 2,
    (box[1] + box[3]) / 2
  ];

  var quadkey = tilebelt.tileToQuadkey(tile);
  var infoText = formatTileInfo(tile);

  return {
    type: 'Feature',
    properties: {
      text: infoText,
      quadkey: quadkey,
      infoText: infoText
    },
    geometry: {
      type: 'Point',
      coordinates: center
    }
  };
}

function formatTileInfo(tile) {
  var box = tilebelt.tileToBBOX(tile);
  var center = [
    (box[0] + box[2]) / 2,
    (box[1] + box[3]) / 2
  ];

  var quadkey = tilebelt.tileToQuadkey(tile);
  const centerText = `緯度経度:\nlat ${center[1].toFixed(4)}, lon ${center[0].toFixed(4)}`;
  const zoomText = `Zoomレベル:\n${tile[2]}`;
  const tileText = `Tile:\n${JSON.stringify(tile)}`;
  const quadkeyText = `Quadkey:\n${quadkey}`;

  return `${centerText}\n\n${zoomText}\n\n${tileText}\n\n${quadkeyText}`;
}

function copyToClipboard(str) {
  const el = document.createElement('textarea');
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}


function showSnackbar() {
    var x = document.getElementById('snackbar');
    x.className = 'show';
    setTimeout(function(){ x.className = x.className.replace('show', ''); }, 2000);
}

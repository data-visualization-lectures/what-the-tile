const maplibregl = require('maplibre-gl');
const tilebelt = require('@mapbox/tilebelt');
const tc = require('@mapbox/tile-cover');

var map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  center: [0, 25],
  zoom: 1.3,
  maxZoom: 18
});

// Simple Nominatim-based geocoder control
class SimpleGeocoder {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.cssText = 'position: relative; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1);';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search places...';
    input.style.cssText = 'width: 200px; padding: 5px; border: 1px solid #ccc; border-radius: 3px;';

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.search(input.value);
      }
    });

    this.container.appendChild(input);
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
  { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' }
];

// Map style switcher control
class StyleSwitcher {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.cssText = 'display: flex; gap: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0,0,0,0.1);';

    const select = document.createElement('select');
    select.style.cssText = 'padding: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px;';

    styleOptions.forEach((style, index) => {
      const option = document.createElement('option');
      option.value = style.url;
      option.textContent = style.name;
      if (style.name === 'Voyager') option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      this.map.setStyle(e.target.value);

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

map.addControl(new SimpleGeocoder(), 'top-left');
map.addControl(new StyleSwitcher(), 'top-left');

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

map.on('load', initializeTileLayers);

map.on('moveend', update);

map.on('click', (e) => {
  if (!map.getLayer('tiles-shade')) {
    return;
  }
  features = map.queryRenderedFeatures(e.point, {layers: ['tiles-shade']});
  if (features && features.length > 0) {
    copyToClipboard(features[0].properties.quadkey)
    showSnackbar()
  }
})

function update() {
  updateTiles();
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

  var feature = {
    type: 'Feature',
    properties: {
      even: ((tile[0] + tile[1]) % 2 == 0),
      quadkey: quadkey
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

  return {
    type: 'Feature',
    properties: {
      text: 'Tile: ' + JSON.stringify(tile) + '\nQuadkey: ' + quadkey + '\nZoom: ' + tile[2],
      quadkey: quadkey
    },
    geometry: {
      type: 'Point',
      coordinates: center
    }
  };
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

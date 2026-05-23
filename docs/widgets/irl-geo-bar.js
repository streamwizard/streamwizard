var COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

// WMO weather code → short description
var WMO_CODES = {
  0:'Clear',1:'Mostly Clear',2:'Partly Cloudy',3:'Overcast',
  45:'Fog',48:'Icy Fog',
  51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',
  61:'Light Rain',63:'Rain',65:'Heavy Rain',
  71:'Light Snow',73:'Snow',75:'Heavy Snow',77:'Snow Grains',
  80:'Showers',81:'Rain Showers',82:'Heavy Showers',
  85:'Snow Showers',86:'Heavy Snow Showers',
  95:'Thunderstorm',96:'Hail Storm',99:'Heavy Hail Storm',
};

// --- State ---
var isMetric        = true;
var stateUrl        = null;
var subscriberToken = null;
var overlayItemId   = null;
var totalMeters     = 0;
var lastLat         = null;
var lastLng         = null;
var saveTimer       = null;
var unsavedMeters   = 0;

// Throttle state for external API calls
var lastWeatherFetch  = 0;
var lastLocationFetch = 0;
var lastLocationMeters = 0;
var WEATHER_INTERVAL  = 5 * 60 * 1000; // 5 minutes
var LOCATION_DISTANCE = 300;            // fetch new location every 300 m

// --- Helpers ---
function toCompass(deg) {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function hide(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function formatDistance(meters) {
  if (isMetric) {
    return meters >= 1000
      ? (meters / 1000).toFixed(2) + ' km'
      : Math.round(meters) + ' m';
  }
  var feet = meters * 3.281;
  return feet >= 5280
    ? (feet / 5280).toFixed(2) + ' mi'
    : Math.round(feet) + ' ft';
}

// Haversine — returns metres between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  var R   = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- State persistence ---
function saveState() {
  if (!stateUrl || !subscriberToken || !overlayItemId) return;
  fetch(stateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: subscriberToken,
      itemId: overlayItemId,
      state: { total_meters: totalMeters },
    }),
  }).catch(function () {});
  unsavedMeters = 0;
}

// Debounce: save at most once every 30 s, or immediately after 50 m walked
function scheduleSave(delta) {
  unsavedMeters += delta;
  if (unsavedMeters >= 50) {
    if (saveTimer) clearTimeout(saveTimer);
    saveState();
    return;
  }
  if (!saveTimer) {
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveState();
    }, 30000);
  }
}

// --- Widget load ---
window.addEventListener('onWidgetLoad', function (e) {
  var d       = e.detail.fieldData;
  var session = e.detail.session || {};

  isMetric        = d.units !== 'imperial';
  stateUrl        = window.StreamWizard ? window.StreamWizard.stateUrl : null;
  subscriberToken = session.subscriberToken || null;
  overlayItemId   = session.overlayItemId   || null;

  document.getElementById('speed-unit').textContent = isMetric ? 'km/h' : 'mph';
  document.getElementById('alt-unit').textContent   = isMetric ? 'm'    : 'ft';

  if (d.show_altitude    === false) { hide('alt-block');      hide('alt-divider');       }
  if (d.show_heading     === false) { hide('heading-block');  hide('hdg-divider');       }
  if (d.show_distance    === false) { hide('distance-block'); hide('dist-divider');       }
  if (d.show_weather     === false) { hide('weather-block');  hide('weather-divider');   }
  if (d.show_location    === false) { hide('location-block'); hide('location-divider');  }

  // Restore persisted distance
  if (stateUrl && subscriberToken && overlayItemId) {
    fetch(stateUrl + '?token=' + encodeURIComponent(subscriberToken) + '&itemId=' + encodeURIComponent(overlayItemId))
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (body.state && body.state.total_meters != null) {
          totalMeters = body.state.total_meters;
          document.getElementById('distance-val').textContent = formatDistance(totalMeters);
        }
      })
      .catch(function () {});
  }
});

// --- Weather & Location fetches ---
function fetchWeather(lat, lng) {
  var now = Date.now();
  if (now - lastWeatherFetch < WEATHER_INTERVAL) return;
  lastWeatherFetch = now;

  fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,weather_code')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      console.log('[irl-geo-bar] weather response:', data);
      var current = data.current;
      if (!current) return;
      var temp = isMetric
        ? Math.round(current.temperature_2m)
        : Math.round(current.temperature_2m * 9/5 + 32);
      var unit = isMetric ? '°C' : '°F';
      var desc = WMO_CODES[current.weather_code] || 'Unknown';

      var tempEl = document.getElementById('weather-temp');
      var unitEl = document.getElementById('weather-temp-unit');
      var descEl = document.getElementById('weather-desc');
      if (tempEl) tempEl.textContent = temp;
      if (unitEl) unitEl.textContent = unit;
      if (descEl) descEl.textContent = desc;
    })
    .catch(function() {});
}

function fetchLocation(lat, lng) {
  var now = Date.now();
  var distSinceLastFetch = totalMeters - lastLocationMeters;
  if (now - lastLocationFetch < 60000 && distSinceLastFetch < LOCATION_DISTANCE) return;
  lastLocationFetch = now;
  lastLocationMeters = totalMeters;

  fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      console.log('[irl-geo-bar] location response:', data);
      var addr = data.address || {};
      var place = addr.city || addr.town || addr.village || addr.hamlet
               || addr.suburb || addr.county || addr.state || data.display_name || '--';
      var locEl = document.getElementById('location-val');
      if (locEl) locEl.textContent = place;
    })
    .catch(function() {});
}

// --- Geo events ---
window.addEventListener('onEventReceived', function (e) {
  if (e.detail.listener !== 'streamwizard.geo') return;

  var geo = e.detail.event;
  if (!geo) return;

  // Speed (m/s → display unit)
  var speedEl = document.getElementById('speed-val');
  if (speedEl) {
    speedEl.textContent = geo.speed != null && geo.speed >= 0
      ? Math.round(isMetric ? geo.speed * 3.6 : geo.speed * 2.237)
      : '0';
  }

  // Altitude
  var altEl = document.getElementById('alt-val');
  if (altEl) {
    altEl.textContent = geo.altitude != null
      ? (isMetric ? Math.round(geo.altitude) : Math.round(geo.altitude * 3.281))
      : '--';
  }

  // Heading
  var hdgEl = document.getElementById('heading-val');
  if (hdgEl) hdgEl.textContent = geo.heading != null ? toCompass(geo.heading) : '--';

  // Distance — Haversine from last known position
  if (lastLat !== null && lastLng !== null) {
    var delta = haversine(lastLat, lastLng, geo.latitude, geo.longitude);

    // Ignore GPS jitter (< 3 m) and impossible jumps (> 150 m between pings)
    if (delta >= 3 && delta <= 150) {
      totalMeters += delta;
      var distEl = document.getElementById('distance-val');
      if (distEl) distEl.textContent = formatDistance(totalMeters);
      scheduleSave(delta);
    }
  }

  lastLat = geo.latitude;
  lastLng = geo.longitude;

  // External API calls — throttled
  fetchWeather(geo.latitude, geo.longitude);
  fetchLocation(geo.latitude, geo.longitude);
});

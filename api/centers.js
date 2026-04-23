// =============================================
// BreatheEasy API — Screening Centers Endpoint
// =============================================
// GET or POST /api/centers
// Returns actual screening centers sorted by distance
// + verified source links + Google Maps + call script
// =============================================

var https = require('https');
var path = require('path');
var ALL_CENTERS = require('./centers-data.json');

// --- Haversine distance (miles) ---
function haversine(lat1, lon1, lat2, lon2) {
  var R = 3958.8; // Earth radius in miles
  var toRad = Math.PI / 180;
  lat1 *= toRad; lon1 *= toRad; lat2 *= toRad; lon2 *= toRad;
  var dlat = lat2 - lat1;
  var dlon = lon2 - lon1;
  var a = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// --- Get coordinates for a zip code via free API ---
function getZipCoords(zip) {
  return new Promise(function(resolve, reject) {
    var url = 'https://api.zippopotam.us/us/' + zip;
    https.get(url, function(response) {
      var data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          var parsed = JSON.parse(data);
          if (parsed.places && parsed.places.length > 0) {
            resolve({
              lat: parseFloat(parsed.places[0].latitude),
              lng: parseFloat(parsed.places[0].longitude),
              city: parsed.places[0]['place name'],
              state: parsed.places[0]['state abbreviation']
            });
          } else {
            reject(new Error('Zip code not found'));
          }
        } catch (e) {
          reject(new Error('Failed to parse zip code data'));
        }
      });
    }).on('error', function(err) {
      reject(err);
    });
  });
}

module.exports = function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Use GET or POST method' });
  }

  // Parse params
  var params = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  var zip = (params.zip || '').toString().trim();
  var lang = (params.lang || 'en').toLowerCase();
  var radius = parseInt(params.radius, 10) || 50;

  // Validation
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: true, message: 'zip must be a 5-digit US zip code', code: 'INVALID_INPUT' });
  }
  if (lang !== 'en' && lang !== 'es') {
    return res.status(400).json({ error: true, message: 'lang must be "en" or "es"', code: 'INVALID_INPUT' });
  }
  if (radius < 1 || radius > 200) {
    return res.status(400).json({ error: true, message: 'radius must be between 1 and 200 miles', code: 'INVALID_INPUT' });
  }

  var isEs = lang === 'es';

  // Look up zip coordinates, then find nearby centers
  return getZipCoords(zip).then(function(location) {
    // Calculate distance for each center
    var nearby = [];
    ALL_CENTERS.forEach(function(center) {
      var dist = haversine(location.lat, location.lng, center.lat, center.lng);
      if (dist <= radius) {
        nearby.push({
          name: center.name,
          address: center.address,
          city: center.city,
          state: center.state,
          zip: center.zip,
          phone: center.phone,
          distance_miles: Math.round(dist * 10) / 10,
          acr_designated: center.acr_designated,
          source: center.source
        });
      }
    });

    // Sort by distance
    nearby.sort(function(a, b) { return a.distance_miles - b.distance_miles; });

    // Verified source links
    var verified_sources = [
      {
        rank: 1,
        name: 'ACR Lung Cancer Screening Locator',
        url: 'https://www.acr.org/Clinical-Resources/Lung-Cancer-Screening-Resources/LCS-Locator-Tool',
        description: isEs
          ? 'Busque más centros designados por el ACR por código postal.'
          : 'Search for more ACR-designated centers by zip code.'
      },
      {
        rank: 2,
        name: 'ACR Accredited Facility Search',
        url: 'https://www.acraccreditation.org/accredited-facility-search',
        description: isEs
          ? 'Instalaciones acreditadas por el ACR para CT.'
          : 'ACR-accredited CT facilities.'
      },
      {
        rank: 3,
        name: 'American Cancer Society',
        url: 'https://www.cancer.org/cancer/types/lung-cancer/detection-diagnosis-staging/detection.html',
        description: isEs
          ? 'Guía de detección de la Sociedad Americana del Cáncer.'
          : 'ACS screening guide.'
      },
      {
        rank: 4,
        name: 'American Lung Association — Saved by the Scan',
        url: 'https://www.lung.org/lung-health-diseases/lung-disease-lookup/lung-cancer/saved-by-the-scan',
        description: isEs
          ? 'Programa de detección de la Asociación Americana del Pulmón.'
          : 'ALA screening program.'
      }
    ];

    // Google Maps
    var googleMapsLink = 'https://www.google.com/maps/search/' +
      encodeURIComponent('lung cancer screening center near ' + zip);

    // Call script
    var call_script;
    if (isEs) {
      call_script = {
        title: 'Qué decir cuando llame',
        intro: 'Hola, me gustaría programar una tomografía de baja dosis (LDCT) para detección de cáncer de pulmón.',
        questions: [
          '¿Aceptan mi seguro médico? Mi plan es [nombre del seguro].',
          '¿Son un centro designado por el ACR para detección de cáncer de pulmón?',
          '¿Necesito una orden médica antes de la cita?',
          '¿Cuál es el costo con el código CPT 71271 y modificador 33?',
          '¿Cuánto tiempo tardan los resultados?',
          '¿Cuál es la próxima cita disponible?'
        ],
        tip: 'Consejo: Mencione que es detección preventiva bajo USPSTF 2021, cubierta a $0 bajo la ACA.'
      };
    } else {
      call_script = {
        title: 'What to say when you call',
        intro: 'Hi, I would like to schedule a low-dose CT scan (LDCT) for lung cancer screening.',
        questions: [
          'Do you accept my insurance? My plan is [insurance name].',
          'Are you an ACR-designated lung cancer screening center?',
          'Do I need a doctor\'s order or referral before the appointment?',
          'What is the cost if billed as a preventive service with CPT code 71271 and modifier 33?',
          'How long does it take to get the results?',
          'What is the next available appointment?'
        ],
        tip: 'Tip: Mention this is a preventive screening under USPSTF 2021 guidelines, covered at $0 under the ACA.'
      };
    }

    return res.status(200).json({
      zip: zip,
      location: location.city + ', ' + location.state,
      radius_miles: radius,
      centers_found: nearby.length,
      centers: nearby,
      verified_sources: verified_sources,
      google_maps_link: googleMapsLink,
      call_script: call_script,
      note: isEs
        ? nearby.length > 0
          ? 'Centros de detección encontrados cerca de su código postal. Use las fuentes verificadas para encontrar más.'
          : 'No se encontraron centros en nuestra base de datos para este código postal. Use las fuentes verificadas o Google Maps.'
        : nearby.length > 0
          ? 'Screening centers found near your zip code. Use verified sources to find more.'
          : 'No centers in our database for this zip code yet. Use the verified sources or Google Maps to find centers.'
    });
  }).catch(function() {
    return res.status(400).json({
      error: true,
      message: isEs ? 'Código postal no encontrado.' : 'Zip code not found. Please enter a valid US zip code.',
      code: 'INVALID_ZIP'
    });
  });
};

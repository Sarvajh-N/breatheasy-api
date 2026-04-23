// =============================================
// BreatheEasy API — Screening Centers Endpoint
// =============================================
// GET or POST /api/centers
// Finds nearby radiology screening centers via NPI Registry
// Returns verified sources, Google Maps link, and call script
// =============================================

var https = require('https');

function fetchNPI(zip) {
  return new Promise(function(resolve, reject) {
    var url = 'https://npiregistry.cms.hhs.gov/api/?version=2.1'
      + '&taxonomy_description=radiology'
      + '&postal_code=' + encodeURIComponent(zip)
      + '&limit=10'
      + '&enumeration_type=NPI-2';

    https.get(url, function(response) {
      var data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse NPI Registry response'));
        }
      });
    }).on('error', function(err) {
      reject(err);
    });
  });
}

function parseNPIResults(data) {
  if (!data || !data.results || data.results.length === 0) {
    return [];
  }

  return data.results.map(function(r) {
    var basic = r.basic || {};
    var name = basic.organization_name || basic.name || 'Unknown';
    var npi = r.number || null;
    var status = basic.status === 'A' ? 'Active' : 'Deactivated';

    // Find LOCATION address (type = LOCATION, not MAILING)
    var address = null;
    var phone = null;
    if (r.addresses && r.addresses.length > 0) {
      var loc = r.addresses.find(function(a) {
        return a.address_purpose === 'LOCATION';
      }) || r.addresses[0];

      address = {
        line1: loc.address_1 || '',
        line2: loc.address_2 || '',
        city: loc.city || '',
        state: loc.state || '',
        zip: loc.postal_code || ''
      };
      phone = loc.telephone_number || null;
    }

    // Taxonomy descriptions
    var taxonomies = [];
    if (r.taxonomies && r.taxonomies.length > 0) {
      taxonomies = r.taxonomies.map(function(t) {
        return t.desc || t.taxonomy_description || '';
      }).filter(function(d) { return d.length > 0; });
    }

    return {
      name: name,
      npi: npi,
      address: address,
      phone: phone,
      status: status,
      taxonomy_descriptions: taxonomies
    };
  });
}

function getVerifiedSources(lang) {
  var isEs = lang === 'es';
  return [
    {
      name: 'ACR Lung Cancer Screening Locator',
      url: 'https://www.acraccreditation.org/lung-cancer-screening-center/find-a-center',
      description: isEs
        ? 'Buscador oficial del Colegio Americano de Radiología para centros designados de detección de cáncer de pulmón.'
        : 'Official American College of Radiology locator for designated lung cancer screening centers.'
    },
    {
      name: 'ACR Accredited Facility Search',
      url: 'https://www.acraccreditation.org/accredited-facility-search',
      description: isEs
        ? 'Busque instalaciones acreditadas por el ACR para tomografía computarizada (CT).'
        : 'Search for ACR-accredited facilities for computed tomography (CT).'
    },
    {
      name: 'American Cancer Society — Screening Info',
      url: 'https://www.cancer.org/cancer/lung-cancer/detection-diagnosis-staging/detection.html',
      description: isEs
        ? 'Guía de la Sociedad Americana del Cáncer sobre la detección del cáncer de pulmón y qué esperar.'
        : 'American Cancer Society guide on lung cancer screening and what to expect.'
    }
  ];
}

function getCallScript(lang) {
  var isEs = lang === 'es';
  if (isEs) {
    return {
      title: 'Guión para llamar al centro de detección',
      intro: 'Hola, me gustaría programar una tomografía de baja dosis (LDCT) para detección de cáncer de pulmón.',
      questions: [
        '¿Aceptan mi seguro médico? Mi plan es [nombre del seguro].',
        '¿Son un centro designado de detección de cáncer de pulmón por el ACR?',
        '¿Necesito una orden médica o referencia antes de la cita?',
        '¿Cuál es el costo si se factura como servicio preventivo con el código CPT 71271 y modificador 33?',
        '¿Cuánto tiempo tarda en llegar el resultado?',
        '¿Cuál es la próxima cita disponible?'
      ],
      tip: 'Consejo: Mencione que esto es una detección preventiva bajo las guías USPSTF 2021, cubierta a $0 bajo la ACA.'
    };
  }
  return {
    title: 'Call Script for Screening Center',
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

module.exports = function handler(req, res) {
  // CORS — allow any website to call this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Use GET or POST method' });
  }

  // Parse params from query (GET) or body (POST)
  var params = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  var zip = (params.zip || '').toString().trim();
  var lang = (params.lang || 'en').toLowerCase();
  var distance = parseInt(params.distance, 10) || 25;

  // --- Input validation ---
  var errors = [];

  if (!/^\d{5}$/.test(zip)) {
    errors.push('zip must be a 5-digit US zip code');
  }
  if (lang !== 'en' && lang !== 'es') {
    errors.push('lang must be "en" or "es"');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: true, message: errors.join('; '), code: 'INVALID_INPUT' });
  }

  var isEs = lang === 'es';

  // --- Call NPI Registry ---
  return fetchNPI(zip).then(function(npiData) {
    var facilities = parseNPIResults(npiData);

    var googleMapsQuery = encodeURIComponent('lung cancer screening center near ' + zip);
    var googleMapsLink = 'https://www.google.com/maps/search/' + googleMapsQuery;

    var result = {
      zip: zip,
      distance_miles: distance,
      verified_sources: getVerifiedSources(lang),
      npi_facilities: facilities,
      npi_result_count: facilities.length,
      google_maps_link: googleMapsLink,
      call_script: getCallScript(lang),
      note: isEs
        ? 'Los resultados del NPI muestran centros de radiología registrados cerca de su código postal. Verifique la acreditación ACR usando los enlaces anteriores.'
        : 'NPI results show registered radiology facilities near your zip code. Verify ACR accreditation using the links above.'
    };

    return res.status(200).json(result);
  }).catch(function(err) {
    return res.status(502).json({
      error: true,
      message: isEs
        ? 'No se pudo contactar el registro NPI. Intente de nuevo más tarde.'
        : 'Could not reach the NPI Registry. Please try again later.',
      detail: err.message
    });
  });
};

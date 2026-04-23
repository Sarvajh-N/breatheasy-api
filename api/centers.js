// =============================================
// BreatheEasy API — Screening Centers Endpoint
// =============================================
// GET or POST /api/centers
// Returns verified screening center sources, Google Maps link, and call script
// =============================================

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

  // --- Input validation ---
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: true, message: 'zip must be a 5-digit US zip code', code: 'INVALID_INPUT' });
  }
  if (lang !== 'en' && lang !== 'es') {
    return res.status(400).json({ error: true, message: 'lang must be "en" or "es"', code: 'INVALID_INPUT' });
  }

  var isEs = lang === 'es';

  // --- Verified sources (ranked by trust level) ---
  var verified_sources = [
    {
      rank: 1,
      name: 'ACR Lung Cancer Screening Locator',
      organization: 'American College of Radiology',
      url: 'https://www.acr.org/Clinical-Resources/Lung-Cancer-Screening-Resources/LCS-Locator-Tool',
      description: isEs
        ? 'Estándar de oro. Centros específicamente designados por el ACR para detección de cáncer de pulmón. Busque por código postal.'
        : 'Gold standard. Centers specifically designated by ACR for lung cancer screening. Search by zip code.',
      trust_level: 'Highest — ACR-designated screening centers'
    },
    {
      rank: 2,
      name: 'ACR Accredited Facility Search',
      organization: 'American College of Radiology',
      url: 'https://www.acraccreditation.org/accredited-facility-search',
      description: isEs
        ? 'Instalaciones acreditadas por el ACR para tomografía computarizada (CT). Usado por la Asociación Americana del Pulmón.'
        : 'ACR-accredited facilities for computed tomography (CT). Used by the American Lung Association.',
      trust_level: 'High — ACR CT accreditation'
    },
    {
      rank: 3,
      name: 'American Cancer Society',
      organization: 'American Cancer Society',
      url: 'https://www.cancer.org/cancer/types/lung-cancer/detection-diagnosis-staging/detection.html',
      description: isEs
        ? 'Guía de la Sociedad Americana del Cáncer sobre detección de cáncer de pulmón y qué esperar.'
        : 'American Cancer Society guide on lung cancer screening and what to expect.',
      trust_level: 'High — ACS guidelines and resources'
    },
    {
      rank: 4,
      name: 'American Lung Association — Saved by the Scan',
      organization: 'American Lung Association',
      url: 'https://www.lung.org/lung-health-diseases/lung-disease-lookup/lung-cancer/saved-by-the-scan',
      description: isEs
        ? 'Programa de la Asociación Americana del Pulmón para detección de cáncer de pulmón. Incluye guía de conversación con su médico.'
        : 'American Lung Association screening program. Includes doctor conversation guide and eligibility quiz.',
      trust_level: 'High — ALA screening program'
    }
  ];

  // --- Google Maps search ---
  var googleMapsQuery = encodeURIComponent('lung cancer screening center near ' + zip);
  var googleMapsLink = 'https://www.google.com/maps/search/' + googleMapsQuery;

  // --- Call script ---
  var call_script;
  if (isEs) {
    call_script = {
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
    verified_sources: verified_sources,
    google_maps_link: googleMapsLink,
    call_script: call_script,
    note: isEs
      ? 'Use las fuentes verificadas arriba para encontrar centros de detección designados por el ACR cerca de su código postal.'
      : 'Use the verified sources above to find ACR-designated screening centers near your zip code.'
  });
};

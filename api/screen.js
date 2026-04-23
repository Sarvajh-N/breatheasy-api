// =============================================
// BreatheEasy API — Screen Endpoint (All-in-One)
// =============================================
// POST /api/screen
// Combines eligibility check + verified center sources
// in a single call for convenience
// =============================================

module.exports = function handler(req, res) {
  // CORS — allow any website to call this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Use POST method' });
  }

  var body = req.body || {};
  var age = parseFloat(body.age);
  var cigarettesPerDay = parseFloat(body.cigarettes_per_day);
  var yearsSmoked = parseFloat(body.years_smoked);
  var quitYears = parseFloat(body.quit_years);
  var zip = (body.zip || '').toString().trim();
  var lang = (body.lang || 'en').toLowerCase();

  // --- Input validation ---
  var errors = [];

  if (isNaN(age) || age < 1 || age > 120) {
    errors.push('age must be a number between 1 and 120');
  }
  if (isNaN(cigarettesPerDay) || cigarettesPerDay < 0) {
    errors.push('cigarettes_per_day must be a number >= 0');
  }
  if (isNaN(yearsSmoked) || yearsSmoked < 0) {
    errors.push('years_smoked must be a number >= 0');
  }
  if (isNaN(quitYears) || quitYears < 0) {
    errors.push('quit_years must be a number >= 0');
  }
  if (zip && !/^\d{5}$/.test(zip)) {
    errors.push('zip must be a 5-digit US ZIP code');
  }
  if (lang !== 'en' && lang !== 'es') {
    errors.push('lang must be "en" or "es"');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: true, message: errors.join('; '), code: 'INVALID_INPUT' });
  }

  if (yearsSmoked > age) {
    return res.status(400).json({
      error: true,
      message: 'years_smoked (' + yearsSmoked + ') cannot exceed age (' + age + ')',
      code: 'INVALID_INPUT'
    });
  }

  var isEs = lang === 'es';

  // --- USPSTF 2021 eligibility logic ---
  var packYears = (cigarettesPerDay / 20) * yearsSmoked;
  var ageOk = age >= 50 && age <= 80;
  var packOk = packYears >= 20;
  var quitOk = quitYears <= 15;
  var eligible = ageOk && packOk && quitOk;

  // --- Build result ---
  var result = {
    eligible: eligible,
    criteria_met: {
      age_50_to_80: ageOk,
      pack_years_gte_20: packOk,
      quit_within_15_years: quitOk
    },
    pack_years_calculated: Math.round(packYears * 10) / 10,
    guideline: 'USPSTF 2021 Grade B Recommendation'
  };

  if (eligible) {
    result.billing_codes = {
      cpt: '71271',
      cpt_description: 'Low-dose CT scan for lung cancer screening',
      icd10: [
        { code: 'Z87.891', description: 'Personal history of nicotine dependence' },
        { code: 'Z12.2', description: 'Screening for malignant neoplasm of respiratory organs' }
      ],
      modifier: '33',
      modifier_description: 'Preventive service'
    };
    result.cost = isEs
      ? '$0 bajo la ACA — sin copago, sin deducible para adultos elegibles'
      : '$0 under ACA — no copay, no deductible for eligible adults';
    result.next_steps = isEs
      ? ['Descargue el PDF de referencia', 'Encuentre un centro de detección cercano', 'Lleve el PDF a su cita médica']
      : ['Download referral PDF', 'Find a nearby screening center', 'Bring the PDF to your doctor appointment'];
  } else {
    var reasons = [];
    if (!ageOk) reasons.push(isEs ? 'La edad debe ser 50-80 (la suya: ' + age + ')' : 'Age must be 50-80 (yours: ' + age + ')');
    if (!packOk) reasons.push(isEs ? 'Se necesitan 20+ paquetes-año (los suyos: ' + result.pack_years_calculated + ')' : 'Need 20+ pack-years (yours: ' + result.pack_years_calculated + ')');
    if (!quitOk) reasons.push(isEs ? 'Debe haber dejado de fumar en los últimos 15 años (los suyos: ' + quitYears + ')' : 'Must have quit within 15 years (yours: ' + quitYears + ')');
    result.reasons_not_eligible = reasons;
    result.message = isEs
      ? 'No cumple los criterios actuales de la USPSTF, pero consulte a su médico si tiene factores de riesgo.'
      : 'Does not meet current USPSTF criteria, but consult your doctor if you have risk factors.';
    result.risk_factors = isEs
      ? ['Exposición al humo de segunda mano', 'Exposición al radón', 'Vapeo excesivo', 'Enfermedades pulmonares como EPOC o fibrosis pulmonar']
      : ['Secondhand smoke exposure', 'Radon exposure', 'Excessive vaping', 'Lung diseases like COPD or pulmonary fibrosis'];
  }

  // --- Verified sources (ranked by trust) ---
  result.verified_sources = [
    {
      rank: 1,
      name: 'ACR Lung Cancer Screening Locator',
      url: 'https://www.acr.org/Clinical-Resources/Lung-Cancer-Screening-Resources/LCS-Locator-Tool',
      description: isEs ? 'Estándar de oro — centros designados por el ACR' : 'Gold standard — ACR-designated screening centers'
    },
    {
      rank: 2,
      name: 'ACR Accredited Facility Search',
      url: 'https://www.acraccreditation.org/accredited-facility-search',
      description: isEs ? 'Instalaciones acreditadas por el ACR para CT' : 'ACR-accredited CT facilities'
    },
    {
      rank: 3,
      name: 'American Cancer Society',
      url: 'https://www.cancer.org/cancer/types/lung-cancer/detection-diagnosis-staging/detection.html',
      description: isEs ? 'Guía de detección de la Sociedad Americana del Cáncer' : 'ACS screening guide'
    },
    {
      rank: 4,
      name: 'American Lung Association — Saved by the Scan',
      url: 'https://www.lung.org/lung-health-diseases/lung-disease-lookup/lung-cancer/saved-by-the-scan',
      description: isEs ? 'Programa de detección de la Asociación Americana del Pulmón' : 'ALA screening program'
    }
  ];

  // --- Call script ---
  if (eligible) {
    result.call_script = isEs
      ? 'Hola, me gustaría programar una tomografía de baja dosis para detección de cáncer de pulmón. '
        + 'Cumplo con los criterios de la USPSTF. Mi código CPT es 71271, diagnósticos Z87.891 y Z12.2, modificador 33. '
        + 'Esto debería estar cubierto al 100% bajo la ACA sin copago ni deducible. '
        + '¿Pueden verificar mi cobertura y programar una cita?'
      : 'Hi, I would like to schedule a low-dose CT scan for lung cancer screening. '
        + 'I meet the USPSTF criteria. My CPT code is 71271, diagnosis codes Z87.891 and Z12.2, modifier 33. '
        + 'This should be covered at 100% under the ACA with no copay or deductible. '
        + 'Can you verify my coverage and schedule an appointment?';
  } else {
    result.call_script = isEs
      ? 'Hola, me gustaría hablar con mi médico sobre la detección de cáncer de pulmón. '
        + 'Tengo factores de riesgo y me gustaría discutir mis opciones.'
      : 'Hi, I would like to talk to my doctor about lung cancer screening. '
        + 'I have risk factors and would like to discuss my options.';
  }

  // --- Referral PDF ---
  result.referral_pdf_url = '/api/referral';
  result.referral_pdf_note = isEs
    ? 'Envíe POST a /api/referral con los mismos datos para generar un PDF de referencia.'
    : 'POST the same body to /api/referral to generate a referral PDF.';

  // --- Google Maps (if zip provided) ---
  if (zip) {
    result.google_maps_search = 'https://www.google.com/maps/search/' + encodeURIComponent('lung cancer screening center near ' + zip);
  }

  return res.status(200).json(result);
};

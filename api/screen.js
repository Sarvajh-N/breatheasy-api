// =============================================
// BreatheEasy API — Screen Endpoint (All-in-One)
// =============================================
// POST /api/screen
// Combines eligibility check + nearby centers
// in a single call for convenience
// =============================================

var https = require('https');

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

  // --- USPSTF 2021 eligibility logic ---
  var packYears = (cigarettesPerDay / 20) * yearsSmoked;
  var ageOk = age >= 50 && age <= 80;
  var packOk = packYears >= 20;
  var quitOk = quitYears <= 15;
  var eligible = ageOk && packOk && quitOk;

  // --- Build eligibility result ---
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
    result.cost = lang === 'es'
      ? '$0 bajo la ACA — sin copago, sin deducible para adultos elegibles'
      : '$0 under ACA — no copay, no deductible for eligible adults';
    result.next_steps = lang === 'es'
      ? ['Descargue el PDF de referencia', 'Encuentre un centro de detección cercano', 'Lleve el PDF a su cita médica']
      : ['Download referral PDF', 'Find a nearby screening center', 'Bring the PDF to your doctor appointment'];
  } else {
    var reasons = [];
    var reasonsEs = [];
    if (!ageOk) {
      reasons.push('Age must be 50-80 (yours: ' + age + ')');
      reasonsEs.push('La edad debe ser 50-80 (la suya: ' + age + ')');
    }
    if (!packOk) {
      reasons.push('Need 20+ pack-years (yours: ' + result.pack_years_calculated + ')');
      reasonsEs.push('Se necesitan 20+ paquetes-año (los suyos: ' + result.pack_years_calculated + ')');
    }
    if (!quitOk) {
      reasons.push('Must have quit within 15 years (yours: ' + quitYears + ')');
      reasonsEs.push('Debe haber dejado de fumar en los últimos 15 años (los suyos: ' + quitYears + ')');
    }
    result.reasons_not_eligible = lang === 'es' ? reasonsEs : reasons;
    result.message = lang === 'es'
      ? 'No cumple los criterios actuales de la USPSTF, pero consulte a su médico si tiene factores de riesgo.'
      : 'Does not meet current USPSTF criteria, but consult your doctor if you have risk factors.';
    result.risk_factors = lang === 'es'
      ? ['Exposición al humo de segunda mano', 'Exposición al radón', 'Vapeo excesivo', 'Enfermedades pulmonares como EPOC o fibrosis pulmonar']
      : ['Secondhand smoke exposure', 'Radon exposure', 'Excessive vaping', 'Lung diseases like COPD or pulmonary fibrosis'];
  }

  // --- Verified source links ---
  result.sources = {
    acr_locator: 'https://www.acr.org/Clinical-Resources/Lung-Cancer-Screening-Resources/LCS-Locator-Tool',
    acr_accreditation: 'https://www.acraccreditation.org/modalities/ct',
    acs_guidelines: 'https://www.cancer.org/cancer/types/lung-cancer/detection-diagnosis-staging/detection.html',
    uspstf: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening'
  };

  // --- Call script ---
  if (eligible) {
    result.call_script = lang === 'es'
      ? 'Hola, me gustaría programar una tomografía computarizada de baja dosis para detección de cáncer de pulmón. '
        + 'Cumplo con los criterios de la USPSTF. Mi código CPT es 71271, diagnósticos Z87.891 y Z12.2, modificador 33. '
        + 'Esto debería estar cubierto al 100% bajo la ACA sin copago ni deducible. '
        + '¿Pueden verificar mi cobertura y programar una cita?'
      : 'Hi, I would like to schedule a low-dose CT scan for lung cancer screening. '
        + 'I meet the USPSTF criteria. My CPT code is 71271, diagnosis codes Z87.891 and Z12.2, modifier 33. '
        + 'This should be covered at 100% under the ACA with no copay or deductible. '
        + 'Can you verify my coverage and schedule an appointment?';
  } else {
    result.call_script = lang === 'es'
      ? 'Hola, me gustaría hablar con mi médico sobre la detección de cáncer de pulmón. '
        + 'No cumplo con todos los criterios de la USPSTF actualmente, pero tengo factores de riesgo y me gustaría discutir mis opciones.'
      : 'Hi, I would like to talk to my doctor about lung cancer screening. '
        + 'I do not currently meet all USPSTF criteria, but I have risk factors and would like to discuss my options.';
  }

  // --- Referral PDF URL ---
  result.referral_pdf_url = '/api/referral';
  result.referral_pdf_note = lang === 'es'
    ? 'Envíe una solicitud POST a /api/referral con los mismos datos para generar un PDF de referencia.'
    : 'POST the same body to /api/referral to generate a referral PDF.';

  // --- If no zip provided, return without centers ---
  if (!zip) {
    result.centers = null;
    result.centers_note = lang === 'es'
      ? 'Proporcione un código postal (zip) para encontrar centros de detección cercanos.'
      : 'Provide a zip code to find nearby screening centers.';
    return res.status(200).json(result);
  }

  // --- Google Maps search link ---
  result.google_maps_search = 'https://www.google.com/maps/search/lung+cancer+screening+center+near+' + zip;

  // --- Fetch nearby radiology facilities from NPI Registry ---
  var npiUrl = 'https://npiregistry.cms.hhs.gov/api/?version=2.1'
    + '&taxonomy_description=radiology'
    + '&postal_code=' + encodeURIComponent(zip)
    + '&limit=10'
    + '&enumeration_type=NPI-2';

  fetchNPI(npiUrl, function (err, facilities) {
    if (err) {
      result.centers = [];
      result.centers_error = lang === 'es'
        ? 'No se pudo consultar el registro NPI. Intente de nuevo más tarde.'
        : 'Could not query NPI registry. Please try again later.';
      return res.status(200).json(result);
    }

    result.centers = facilities;
    result.centers_count = facilities.length;

    if (facilities.length === 0) {
      result.centers_note = lang === 'es'
        ? 'No se encontraron centros de radiología cerca del código postal ' + zip + '. Pruebe con un código postal diferente o use el enlace de Google Maps.'
        : 'No radiology facilities found near ZIP ' + zip + '. Try a different ZIP or use the Google Maps link.';
    }

    return res.status(200).json(result);
  });
};

// --- Helper: fetch NPI Registry data ---
function fetchNPI(url, callback) {
  https.get(url, function (response) {
    var data = '';

    response.on('data', function (chunk) {
      data += chunk;
    });

    response.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        var results = parsed.results || [];
        var facilities = results.map(function (r) {
          var address = (r.addresses && r.addresses[0]) || {};
          var taxonomy = (r.taxonomies && r.taxonomies[0]) || {};
          var name = '';
          if (r.basic) {
            name = r.basic.organization_name || r.basic.name || '';
          }
          return {
            npi: r.number || null,
            name: name,
            address: [
              address.address_1 || '',
              address.address_2 || '',
              address.city || '',
              address.state || '',
              address.postal_code || ''
            ].filter(function (s) { return s; }).join(', '),
            phone: address.telephone_number || null,
            taxonomy: taxonomy.desc || null
          };
        });
        callback(null, facilities);
      } catch (e) {
        callback(e, []);
      }
    });
  }).on('error', function (err) {
    callback(err, []);
  });
}

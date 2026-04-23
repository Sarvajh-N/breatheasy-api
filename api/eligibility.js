// =============================================
// BreatheEasy API — Eligibility Endpoint
// =============================================
// POST /api/eligibility
// Checks USPSTF 2021 lung cancer screening criteria
// Returns eligibility result + billing codes
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

  // --- Build response ---
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

  return res.status(200).json(result);
};

// =============================================
// BreatheEasy API — Root / Documentation
// =============================================
// GET /api
// Returns API documentation and available endpoints
// =============================================

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  return res.status(200).json({
    name: 'BreatheEasy API',
    version: '1.0.0',
    description: 'Lung cancer screening eligibility check, referral PDF generation, and screening center lookup — based on USPSTF 2021 guidelines.',
    endpoints: {
      'POST /api/eligibility': {
        description: 'Check if a patient meets USPSTF 2021 lung cancer screening criteria',
        body: {
          age: 'number (required) — patient age',
          cigarettes_per_day: 'number (required) — average cigarettes smoked per day',
          years_smoked: 'number (required) — total years of smoking',
          quit_years: 'number (required) — years since quitting (0 if still smoking)',
          lang: 'string (optional) — "en" or "es" (default: "en")'
        },
        returns: 'Eligibility result with billing codes (if eligible) or reasons (if not)'
      },
      'POST /api/referral': {
        description: 'Generate a physician referral PDF with CPT/ICD-10 billing codes',
        body: {
          age: 'number (required)',
          cigarettes_per_day: 'number (required)',
          years_smoked: 'number (required)',
          quit_years: 'number (required)',
          lang: 'string (optional) — "en" or "es"',
          format: 'string (optional) — "binary" (default) or "base64"'
        },
        returns: 'PDF file (binary) or JSON with base64-encoded PDF'
      },
      'GET or POST /api/centers': {
        description: 'Find nearby lung cancer screening centers via NPI Registry with verified source links and call script',
        params: {
          zip: 'string (required) — 5-digit US zip code',
          lang: 'string (optional) — "en" or "es" (default: "en")',
          distance: 'number (optional) — search radius in miles (default: 25)'
        },
        returns: 'Verified source links, NPI radiology facilities, Google Maps link, and call script'
      }
    },
    guidelines: {
      source: 'USPSTF 2021 Grade B Recommendation',
      criteria: {
        age: '50-80 years',
        smoking: '20+ pack-year history',
        quit: 'Currently smokes OR quit within last 15 years'
      },
      url: 'https://uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening'
    },
    billing_codes: {
      cpt: '71271 — Low-dose CT scan for lung cancer screening',
      icd10: ['Z87.891 — Personal history of nicotine dependence', 'Z12.2 — Screening for malignant neoplasm of respiratory organs'],
      modifier: '33 — Preventive service ($0 cost-share under ACA)'
    },
    project: {
      website: 'https://sarvajh-n.github.io/BreatheEasy-Initiative',
      github: 'https://github.com/sarvajh-n/BreatheEasy-Initiative',
      author: 'Sarvajh Nadadur — ALCSI Innovation Challenge 2026'
    }
  });
};

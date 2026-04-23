// =============================================
// BreatheEasy API — Referral PDF Endpoint
// =============================================
// POST /api/referral
// Generates a physician referral PDF with billing codes
// Returns PDF as base64 or downloadable binary
// =============================================

var jsPDF = null;

// Dynamic import — jsPDF loaded at runtime
function getJsPDF() {
  if (!jsPDF) {
    jsPDF = require('jspdf');
  }
  return jsPDF;
}

module.exports = function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
  var format = (body.format || 'binary').toLowerCase(); // 'binary' or 'base64'

  // --- Input validation ---
  if (isNaN(age) || isNaN(cigarettesPerDay) || isNaN(yearsSmoked) || isNaN(quitYears)) {
    return res.status(400).json({ error: true, message: 'All fields required: age, cigarettes_per_day, years_smoked, quit_years' });
  }

  // --- Check eligibility first ---
  var packYears = (cigarettesPerDay / 20) * yearsSmoked;
  var eligible = (age >= 50 && age <= 80) && (packYears >= 20) && (quitYears <= 15);

  if (!eligible) {
    return res.status(400).json({
      error: true,
      message: 'Patient does not meet USPSTF 2021 criteria. No referral generated.',
      code: 'NOT_ELIGIBLE'
    });
  }

  // --- Generate PDF ---
  var { jsPDF: JsPDF } = getJsPDF();
  var doc = new JsPDF();

  var packYearsStr = (Math.round(packYears * 10) / 10).toString();
  var quitStatus = quitYears === 0 ? (lang === 'es' ? 'Activo' : 'Active') : quitYears + (lang === 'es' ? ' años' : 'yr');
  var today = new Date().toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  var isEs = lang === 'es';

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BreatheEasy', 15, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(isEs
    ? 'Detección de cáncer de pulmón — Documento de referencia médica'
    : 'Lung Cancer Screening — Physician Referral Document', 15, 28);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text((isEs ? 'Generado: ' : 'Generated: ') + today, 15, 42);

  // Patient info
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(isEs ? 'Información autorreportada del paciente' : 'Patient Self-Reported Information', 15, 55);
  doc.setDrawColor(30, 58, 95);
  doc.line(15, 58, 195, 58);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text((isEs ? 'Edad: ' : 'Age: ') + age, 15, 66);
  doc.text((isEs ? 'Historial de tabaquismo: ' : 'Smoking History: ') + packYearsStr + (isEs ? ' paquetes-año' : ' pack-years'), 15, 74);
  doc.text((isEs ? 'Estado: ' : 'Quit Status: ') + quitStatus, 15, 82);
  doc.text((isEs
    ? 'Criterio de detección: Recomendación USPSTF 2021 Grado B'
    : 'Screening Criteria: USPSTF 2021 Grade B Recommendation'), 15, 90);

  // Billing codes
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(isEs ? 'Códigos de facturación y pedido' : 'Billing & Ordering Codes', 15, 108);
  doc.line(15, 111, 195, 111);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  var codes = isEs ? [
    ['CPT:', '71271', 'TC de baja dosis para detección de cáncer de pulmón'],
    ['ICD-10:', 'Z87.891', 'Historial personal de dependencia a la nicotina'],
    ['ICD-10:', 'Z12.2', 'Detección de neoplasia maligna de órganos respiratorios'],
    ['Modificador:', '33', 'Servicio preventivo de la ACA — $0 costo para el paciente'],
  ] : [
    ['CPT Code:', '71271', 'Low-dose CT scan for lung cancer screening'],
    ['ICD-10:', 'Z87.891', 'Personal history of nicotine dependence'],
    ['ICD-10:', 'Z12.2', 'Screening for malignant neoplasm of respiratory organs'],
    ['Modifier:', '33', 'ACA preventive service — $0 patient cost-share'],
  ];

  var y = 120;
  codes.forEach(function(row) {
    doc.setFont('helvetica', 'bold');
    doc.text(row[0], 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], 55, y);
    doc.setTextColor(100, 100, 100);
    doc.text(row[2], 85, y);
    doc.setTextColor(50, 50, 50);
    y += 10;
  });

  // Why these codes
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(isEs ? 'Por qué importan estos códigos' : 'Why These Codes Matter', 15, y + 12);
  doc.line(15, y + 15, 195, y + 15);
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var explain = isEs ? [
    'Estos códigos aseguran que la detección se facture como servicio preventivo bajo la ACA.',
    'El seguro debe cubrir la TC de baja dosis a $0 — sin copago, sin deducible.',
    '',
    'Sin los códigos correctos, el estudio puede facturarse como diagnóstico, causando costos inesperados.'
  ] : [
    'These codes ensure the screening is billed as a preventive service under the ACA.',
    'Insurance must cover the LDCT scan at $0 — no copay, no deductible.',
    '',
    'Without correct codes, the scan may be billed as diagnostic, causing unexpected costs.'
  ];
  var ey = y + 24;
  explain.forEach(function(l) { doc.text(l, 15, ey); ey += 6; });

  // Note to provider
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(isEs ? 'Nota para el médico' : 'Note to Provider', 15, ey + 10);
  doc.line(15, ey + 13, 195, ey + 13);
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var notes = isEs ? [
    'El paciente completó una autoevaluación que cumple los criterios USPSTF 2021 para detección por TC.',
    '',
    'Por favor verifique el historial de tabaquismo. Se recomienda conversación de decisión compartida según CMS.',
    '',
    'Info: uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening'
  ] : [
    'Patient completed a self-assessment meeting USPSTF 2021 criteria for LDCT screening.',
    '',
    'Please verify smoking history. Shared decision-making conversation recommended per CMS.',
    '',
    'Info: uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening'
  ];
  var ny = ey + 22;
  notes.forEach(function(l) { doc.text(l, 15, ny); ny += 6; });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(isEs
    ? 'Generado por BreatheEasy. No es un documento médico. Requiere verificación del proveedor.'
    : 'Generated by BreatheEasy. Not a medical document. Provider verification required.', 15, 285);

  // Return PDF
  if (format === 'base64') {
    var base64 = doc.output('datauristring');
    return res.status(200).json({
      pdf_base64: base64,
      filename: 'BreatheEasy_Physician_Referral.pdf'
    });
  }

  var pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="BreatheEasy_Physician_Referral.pdf"');
  return res.status(200).send(pdfBuffer);
};

const TITLE_LINKS = new Map([
  ['Standards for general practices', 'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/standards-for-general-practices-5th-ed/table-of-contents'],
  ['General practice standards', 'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/standards-for-general-practices-5th-ed/table-of-contents'],
  ['RACGP Standards for general practices', 'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/standards-for-general-practices-5th-ed/table-of-contents'],
  ['Accreditation resources for general practices', 'https://www.racgp.org.au/running-a-practice/practice-standards/standards-5th-edition/resource-guide'],
  ['CPR in general practice', 'https://www.racgp.org.au/FSDEDEV/media/documents/Running%20a%20practice/Practice%20standards/5th%20edition/FAQ-for-cardiopulmonary-resuscitation-CPR.pdf'],
  ['CPR in general practice guidance', 'https://www.racgp.org.au/FSDEDEV/media/documents/Running%20a%20practice/Practice%20standards/5th%20edition/FAQ-for-cardiopulmonary-resuscitation-CPR.pdf'],
  ['CPR Guidelines', 'https://resus.org.au/guidelines/'],
  ['CPR guidance', 'https://resus.org.au/guidelines/'],
  ['Registration standards', 'https://www.medicalboard.gov.au/sitecore/content/Home/Registration/Registration-Standards/'],
  ['MBS Online', 'https://www.mbsonline.gov.au/'],
  ['Medicare claiming and billing guidance', 'https://www.servicesaustralia.gov.au/mbs-and-dva-billing?context=20'],
  ['MBS billing guidance', 'https://www.servicesaustralia.gov.au/mbs-and-dva-billing?context=20'],
  ['Managing employee absences', 'https://www.fairwork.gov.au/leave/sick-and-carers-leave'],
  ['Minimum employment period', 'https://www.fairwork.gov.au/ending-employment/unfair-dismissal'],
  ['Unfair dismissal', 'https://www.fairwork.gov.au/ending-employment/unfair-dismissal'],
  ['Ending employment', 'https://www.fairwork.gov.au/tools-and-resources/fact-sheets/minimum-workplace-entitlements/ending-employment'],
  ['Work health and safety guidance', 'https://www.safeworkaustralia.gov.au/safety-topic/managing-health-and-safety'],
  ['Notifiable Data Breaches guidance', 'https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches'],
  ['Guide to health privacy', 'https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/health-service-providers/guide-to-health-privacy'],
  ['Data breach response guidance', 'https://www.oaic.gov.au/privacy/notifiable-data-breaches/preventing-preparing-for-and-responding-to-data-breaches/data-breach-preparation-and-response'],
  ['Australian Charter of Healthcare Rights', 'https://www.safetyandquality.gov.au/your-rights/understanding-your-healthcare-rights'],
  ['Privacy guidance', 'https://www.oaic.gov.au/privacy/your-privacy-rights/health-information/health-service-providers'],
  ['Privacy guidance for health service providers', 'https://www.oaic.gov.au/privacy/your-privacy-rights/health-information/health-service-providers'],
])

const PUBLISHER_LINKS = new Map([
  ['RACGP', 'https://www.racgp.org.au/running-a-practice/practice-standards'],
  ['Australian Resuscitation Council', 'https://resus.org.au/guidelines/'],
  ['Medical Board of Australia', 'https://www.medicalboard.gov.au/Registration.aspx'],
  ['Services Australia', 'https://www.servicesaustralia.gov.au/health-professionals'],
  ['Fair Work Ombudsman', 'https://www.fairwork.gov.au/'],
  ['OAIC', 'https://www.oaic.gov.au/privacy/your-privacy-rights/health-information'],
  ['Australian Government', 'https://www.mbsonline.gov.au/'],
])

export function resolveResourceUrl(resource = {}) {
  return resource.url || TITLE_LINKS.get(resource.title) || PUBLISHER_LINKS.get(resource.publisher) || ''
}

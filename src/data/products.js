export const products = [
  {
    slug: 'ai-receptionist',
    name: 'AI Receptionist',
    badge: 'AI RECEPTIONIST',
    headline: 'Answer every patient call, book every patient appointment',
    body: 'MediQo’s AI receptionists answer patient queries and book patient appointments directly into your practice management system – helping to relieve stress for busy admin teams and maximise revenue for the clinic.',
  },
  {
    slug: 'scribe',
    name: 'Scribe',
    badge: 'SCRIBE',
    headline: 'Spend less time documenting, more time with patients',
    body: 'MediQo Scribe captures and structures clinical notes in real time during patient consultations – helping doctors reduce documentation time, stay focused on patients and finish their day with less admin.',
  },
  {
    slug: 'document-sorter',
    name: 'Document Sorter',
    badge: 'DOCUMENT SORTER',
    headline: 'Sort every document, without the manual admin',
    body: 'MediQo automatically identifies, categorises and matches incoming documents to the right patient and workflow – reducing hours of admin for reception teams and helping important information get where it needs to go faster.',
  },
  {
    slug: 'care-plan-generation',
    name: 'Care Plan Generation',
    badge: 'CARE PLAN GENERATION',
    headline: 'Create comprehensive care plans, without the extra admin',
    body: 'MediQo generates comprehensive, Medicare-compliant care plans in the background during patient consultations – helping doctors reduce documentation time while creating consistent, detailed plans that can be reviewed and edited before completion.',
  },
  {
    slug: 'mbs-billing-suggestions',
    name: 'MBS Billing Suggestions',
    badge: 'MBS BILLING SUGGESTIONS',
    headline: 'Capture the right MBS items, at the right time',
    body: 'MediQo identifies relevant MBS billing opportunities during the patient consultation – helping clinicians select appropriate item numbers, reduce missed billing opportunities and maximise eligible practice revenue.',
  },
  {
    slug: 'telehealth',
    name: 'Telehealth',
    badge: 'TELEHEALTH',
    headline: 'Telehealth consults, with a full suite of AI tools as well',
    body: "MediQo's telehealth is built for Australian healthcare — secure, encrypted, hosted in Australia, and built alongside a full suite of AI tools, so doctors can access scribe tools, MBS billing suggestions, history at a glance, and more, without switching between disconnected platforms.",
  },
  {
    slug: 'online-bookings',
    name: 'Online Bookings',
    badge: 'ONLINE BOOKINGS',
    headline: 'Offer online bookings directly from your website',
    body: 'MediQo Online Bookings lets patients find and book available appointments directly into your practice management system – saving you thousands in third-party booking costs, and reducing calls to reception while helping fill appointment books around the clock.',
  },
]

export function getProduct(slug) {
  return products.find((product) => product.slug === slug) || null
}

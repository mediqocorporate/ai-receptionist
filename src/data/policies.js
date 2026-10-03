export const policyCategories = ['All', 'Policies', 'SOPs', 'Checklists', 'HR', 'Accreditation', 'Privacy']

export const policyTemplates = [
  { id: 'new-receptionist-onboarding', title: 'New Receptionist Onboarding Checklist', category: 'Checklists', description: 'A structured induction checklist for new reception and administration team members.' },
  { id: 'privacy-incident-response', title: 'Privacy Incident Response Procedure', category: 'Privacy', description: 'Contain, assess, escalate and document privacy incidents.' },
  { id: 'staff-training-register', title: 'Staff Training Register', category: 'Accreditation', description: 'Track required training, evidence and refresher dates.' },
  { id: 'complaints-handling', title: 'Complaints Handling Procedure', category: 'SOPs', description: 'A calm, consistent workflow for receiving and resolving complaints.' },
  { id: 'gp-onboarding', title: 'GP Onboarding Checklist', category: 'Checklists', description: 'Credentials, systems, billing, clinical and practice orientation.' },
  { id: 'accreditation-evidence', title: 'Accreditation Evidence Checklist', category: 'Accreditation', description: 'Map evidence items, owners, due dates and gaps before assessment.' },
  { id: 'social-media-policy', title: 'Social Media Policy', category: 'Policies', description: 'Set expectations for staff social-media use and confidentiality.' },
  { id: 'business-continuity', title: 'Emergency / Business Continuity Checklist', category: 'Policies', description: 'Prepare roles, contacts and recovery actions for practice disruptions.' },
]

export const wizardQuestions = [
  { key: 'practiceName', label: 'Practice name', placeholder: 'Riverside Medical Centre' },
  { key: 'owner', label: 'Document owner', placeholder: 'Practice Manager' },
  { key: 'reviewCycle', label: 'Review cycle', placeholder: 'Annual' },
  { key: 'notes', label: 'Practice-specific notes', placeholder: 'Add any local process or wording to include' },
]

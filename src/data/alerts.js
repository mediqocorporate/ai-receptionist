export const alerts = [
  {
    id: 'racgp-update', category: 'RACGP', title: 'Accreditation evidence update', date: '3 Oct 2026', severity: 'purple',
    summary: 'Staff-training evidence in your accreditation workspace needs review before the next milestone.',
    affects: 'Potentially — your readiness workspace contains two training evidence items that need review.',
    changed: 'Your readiness register shows a training evidence item that needs updated documentation.',
    action: 'Open Accreditation Assistant, assign the evidence owner and attach or record the latest training evidence.',
    when: 'Review this week and assign an owner if action is required.',
    sources: ['RACGP Standards for general practices'],
  },
  {
    id: 'medicare-update', category: 'Medicare', title: 'Billing workflow review', date: '2 Oct 2026', severity: 'red',
    summary: 'A Medicare billing alert is ready for review in the billing workflow.',
    affects: 'Potentially — confirm whether the workflow applies to services your practice bills.',
    changed: 'A billing guidance item is marked for current-source verification before the workflow is used.',
    action: 'Review the billing policy and confirm the current rule against approved Medicare sources before acting.',
    when: 'Before the affected billing workflow is used.',
    sources: ['Services Australia / MBS Online'],
  },
  {
    id: 'award-update', category: 'Modern Award', title: 'Employment rate review', date: '1 Oct 2026', severity: 'orange',
    summary: 'A Modern Award alert is ready for review ahead of its effective date.',
    affects: 'Potentially — if employees are covered by the relevant award or classification.',
    changed: 'A future-dated employment item is scheduled for manager review.',
    action: 'Confirm the applicable award/classification and update payroll or HR processes only after checking the current source.',
    when: 'Before the relevant effective date.',
    sources: ['Fair Work Ombudsman'],
  },
]

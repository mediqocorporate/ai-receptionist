# Accreditation dataset source

This directory records the provenance of the controlled accreditation build asset supplied by the client.

- Source file: `MediQo_Accreditation_MVP_Readiness_Question_Dataset.xlsx`
- Client version: `0.9 developer build asset – 7 October 2026`
- SHA-256: `bd297da426f82f3f17ae2b9083ab99373cd65a9aab737fd2e9dbca4dc5d17f0b`
- Required sheets: README; Requirements; Questions; Answer Options; Branching Logic; Evidence Criteria; Sources
- Normalized output: `../generated/accreditation-dataset.json`

The workbook is a client-supplied controlled source. The importer at `scripts/import-accreditation-dataset.mjs` validates its structure and emits the checked-in normalized JSON. Rows marked VALIDATE or HOLD are preserved without inventing accreditation classification or readiness logic.

The binary workbook is not duplicated into this repository by the ChatGPT/GitHub connector. Keep the client-supplied workbook unchanged and use the SHA-256 above to verify the exact source before regenerating the normalized asset.

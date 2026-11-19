# MOH guideline notes for KK Manager

Research notes for keeping the game accurate. These are summaries, not quotes.
Gathered 2026-11-19. Anything marked **(check)** should be confirmed by the user or
against the source before we build on it.

## Sources

1. **Polisi Operasi Klinik Kesihatan 2024**, KKM, 90 pages.
   https://www.moh.gov.my/images/04-penerbitan/garis-panduan-kkm/POLISI%20OPERASI%20KLINIK%20KESIHATAN%202024.pdf
2. **Perinatal Care Manual, 4th Edition (2020)**, BPKK, KKM, 460 pages. I read only the first 80 pages.
   https://hq.moh.gov.my/bpkk/images/PERINATAL_CARE_MANUAL_4th_Edition_2020_11Mei2023.pdf
3. **Perinatal Care Manual, 3rd Edition**, the colour-code table (JKN Selangor copy).
   https://jknselangor.moh.gov.my/documents/pdf/2016/garis_panduan/kesihatan_ibu/article11.pdf

## Clinic operations (source 1)

- **Hours:** 8:00–17:00 Mon–Fri in most states. Kedah, Kelantan and Terengganu run Sun–Thu,
  with a shorter last working day. Labuan starts at 7:00.
- **Lunch:** 13:00–14:00 Mon–Thu. The Friday break is longer and varies by state.
  - Game note: "did the doctors get lunch at 1pm?" is grounded in policy.
- Registration closes 30 minutes before the clinic closes.
- Some clinics run extended hours (17:00–21:00 weekdays, Saturday mornings) and on-call.
- **Official patient flow:**
  1. Primary triage
  2. Registration
  3. Secondary triage / pre-consultation
  4. Consultation or procedure
  5. Lab / radiology
  6. Pharmacy
  7. Follow-up appointment or referral
- **Primary triage** catches emergencies, flu-like illness and infectious cases.
  Walk-ins are assessed there and either seen the same day or given an appointment.
- **Priority lanes (laluan khas):** pregnant women, the elderly, pensioners, OKU, children aged 2 and under, detainees.
- **Appointment system:** manual or digital booking. Some clinics run staggered
  (berperingkat) appointment slots. There is a "No Wrong Door" policy.
- **Service targets:** pharmacy dispensing within 30 minutes of receiving the prescription.
  The registration-to-consultation waiting-time targets are left blank in the template
  (each clinic sets its own) **(check)**.
- **Who runs the clinic:**
  - The Head of Clinic (Ketua Klinik) is an FMS if there is one, otherwise a Medical Officer,
    otherwise a PPP (Assistant Medical Officer).
  - The Clinic Supervisor is a PPP or nurse.
  - In the game the player is called **Clinic Manager** (user's choice).
- **Staff roles:** FMS, Medical Officer (PP), PPP, nurses (JK), community nurses (JM),
  PPK, pharmacist and assistant pharmacist, lab technologist (JTMP), radiographer,
  dietitian, therapists, admin assistants, drivers.
- **KIA services:** pre-pregnancy care, antenatal, intrapartum (ABC, at some sites), postnatal,
  child growth and development, immunisation, school health, family planning.
- **Contingency:**
  - IT or internet downtime has workaround and helpdesk-reporting procedures.
  - Staff shortages and surges are handled by flexible redeployment, triage and on-call.
  - The policy discourages entering the same data in several systems.
  - It promotes Lean management to cut waiting time.

## Antenatal care (sources 2 and 3)

- **Colour codes** (3rd edition table, the most reliable excerpt I found):
  - **Merah / Kuning:** higher risk. Managed by a specialist or FMS, or referred
    **(check exact wording against the 4th edition)**.
  - **Hijau:** managed at the KK by a Medical Officer. Follow-up can be shared with the
    nurse under the Medical Officer's supervision.
  - **Putih:** nurse care (JK/JM) at the KK or Klinik Desa. Only for mothers with none
    of the red, yellow or green risk factors.
  - Risk is reassessed at set gestation bands: 1–12, 13–22, 23–27, 28–32, 33–36,
    37–40 and >40 weeks. So a mother's code can change during pregnancy.
  - **User's correction:** the code reflects complexity and how often she must be seen.
    Every mother sees a doctor at some point. The code decides how often, and whether
    she needs referring.
  - An automated summary of the 4th edition contradicted itself on the codes, so I did not use it.
- **Suggested visit schedule** (4th edition, Table 2.1, weeks of gestation):
  - First pregnancy: <12, 16–20, 24–26, 28–30, 32–34, 35–36, 37, 38, 39, 40.
  - Later pregnancies: <12, 16–20, 24–26, 28–30, 32–34, 35–36, 38, 40.
  - Some low-risk visits (24–26 and 32–34 weeks) can be virtual for eligible mothers **(check)**.
- **Booking (first) visit:**
  - The doctor's first routine medical examination (RME) happens at booking or within 2 weeks of it.
  - This is a long visit: full history, full examination, and a big blood panel
    (Hb, blood group, VDRL, HIV, HBsAg, thalassaemia screen, and so on).
  - Game note: booking visits are long for both the nurse and the doctor.
- **Routine nurse visit:** BP, weight, urine, fundal height, check for pallor and oedema,
  health education. Bloods follow the schedule. The guideline gives no duration.
  The user says 20–30 minutes depending on complexity.

## Daily-practice rules from the user (how routing really works)

Each antenatal mother's route on the day depends on **which appointments fall today**:

- **Nurse only:** her doctor appointment isn't due yet.
- **Nurse, then doctor:** both appointments fall on the same day.
- **Doctor only:** for example, a review of the weekly BP trend or the blood sugar profile (BSP),
  or a straightforward case.

The MCH jam: registration is first-come-first-served, and everyone queues for the
nurse first. Doctor-only cases get stuck behind 20–30 minute routine nurse visits,
so the doctor sits idle, up to an hour in the morning. The intended fix, which the
player should discover, is an SOP card that sorts patients at registration by the
purpose of their visit.

## Not yet researched

- Postnatal visit schedule (4th edition, chapter 4, about pages 139–158).
- Child health and immunisation clinic flow and timings.
- OPD-specific guidance (for the lighter OPD simulation).

## KK types (Polisi Operasi Klinik Kesihatan 2024, Jadual 1 and staffing table)

Klinik kesihatan are classed Jenis 1 to 7 by mean daily attendance (plus "Super Jenis 1", KKKL, over 2000 a day).

| Type | Patients a day | Services (skop perkhidmatan) |
|---|---|---|
| Jenis 1 | over 800 | 15: OPD, MCH (Ibu dan Anak), emergency, radiology, primary-care lab, pharmacy, dental, nutrition, dietetics, optometry, physiotherapy, occupational therapy, speech therapy, psychology (counselling), medical social work |
| Jenis 3 | 300–500 | the same 15 as Jenis 1 |
| Jenis 4 | 150–300 | 12: OPD, MCH, emergency, radiology, nutrition, dietetics, medical social work, primary-care lab, pharmacy, physiotherapy, occupational therapy, dental (no optometry, speech therapy or psychology) |

Selected staffing norms from the same table (Jenis 1 / 3 / 4):
- Family medicine specialists: 6 / 3 / 1. Medical officers: 32 / 16 / 9.
- Pharmacists 22 / 9 / 6. Assistant pharmacists (U29–U36) 14 / 5 / 4.
- Assistant medical officers (PPP, U29–U36 band) 20 / 14 / 11.
- Lab technologists (U29–U36) 10 / 5 / 3. X-ray radiographers (U29–U36) 4 / 3 / 2.
- Healthcare assistants (PPK, U11–U16) 24 / 14 / 8.

The game's current placeholder volume (40 MCH + 120 OPD = 160 a day) sits at the bottom of Jenis 4.

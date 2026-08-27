# Title-screen prompt (stage: title)

You are doing a **cheap first-pass** screen for a research group focused on:

- Human infectious-disease epidemiology
- Mathematical modelling of respiratory viruses (influenza, RSV, SARS-CoV-2, etc.)
- Public-health relevant observational / interventional epidemiology
- Transferable methods, data, code, models, and theory

## Rules

- Use **title (+ journal id) only**. Do NOT invent abstracts.
- **Keep only original research articles** (and systematic reviews / meta-analyses when clearly research).
- **Exclude non-original article types** even if the topic looks relevant. From the title (and common title cues), drop:
  - Comment / Commentary / Reply / Response
  - Letter / Correspondence / Correspondence reply
  - Editorial / Editor's note / Guest editorial
  - News / Perspective / Viewpoint / Opinion / Essay
  - Narrative review / Invited review (unless it is clearly a systematic review or meta-analysis)
  - Protocol-only announcements, errata, corrections, retractions notices
  - Animal-only studies and unrelated single clinical case reports
- If the title strongly signals one of the excluded types above, set `relevanceScore` **≤ 0.2** and say so in `reason` / `summaryZh`.
- Be inclusive on borderline **original** epidemiology / modelling / vaccine / surveillance papers — humans will review next.
- Score **each paper independently**. Do not let one paper influence another.
- You will usually receive a **batch** of papers. Return one result object per input `id`.

## Criteria tags (optional array)

1. `interest` — novel or personally interesting angle
2. `influential` — strong public-health message
3. `groupRelevant` — respiratory virus epi / RSV / flu / COVID / modelling
4. `reusableMethods` — useful methods / data / models / theory
5. `dubious` — serious methodological doubts (rare at title stage)

## Output

Return STRICT JSON only (no markdown fences).

Batch (preferred):

```json
{
  "results": [
    {
      "id": "doi:10.xxxx/yyyy",
      "relevanceScore": 0.0,
      "criteriaMatched": ["groupRelevant"],
      "summaryZh": "一两句中文：为何相关或不相关",
      "reason": "short English rationale"
    }
  ]
}
```

Single-paper fallback (same fields, no wrapper):

```json
{
  "id": "doi:10.xxxx/yyyy",
  "relevanceScore": 0.0,
  "criteriaMatched": ["groupRelevant"],
  "summaryZh": "一两句中文：为何相关或不相关",
  "reason": "short English rationale"
}
```

`relevanceScore` is 0–1.
- Excluded non-original types (comment / letter / editorial / etc.) or clearly off-topic: **≤ 0.2** (prefer < 0.35).
- Clearly on-topic **original** epi/modelling research: **≥ 0.55**.
Every input `id` must appear exactly once in `results`.

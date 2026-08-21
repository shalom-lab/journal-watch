# Detail-screen prompt (stage: detail)

You are doing a **detail pass** for papers already shortlisted by title screen + human review.

Group focus:

- Human infectious-disease epidemiology
- Mathematical modelling of respiratory viruses (influenza, RSV, SARS-CoV-2, etc.)
- Public-health relevant observational / interventional epidemiology
- Transferable methods, data, code, models, and theory

## Rules

- Use title, abstract (if present), journal, and DOI/URL.
- Prefer original research and systematic reviews.
- Deprioritize commentaries, editorials, narrative reviews, animal-only work.
- Write a useful Chinese summary for group discussion.

## Criteria tags

1. `interest`
2. `influential`
3. `groupRelevant`
4. `reusableMethods`
5. `dubious`

## Output

Return STRICT JSON only (no markdown fences):

```json
{
  "relevanceScore": 0.0,
  "criteriaMatched": ["groupRelevant", "reusableMethods"],
  "summaryZh": "2–4 句中文摘要：研究问题、设计、关键发现、对本组的启发",
  "reason": "short English why keep for discussion"
}
```

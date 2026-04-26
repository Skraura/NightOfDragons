# DoD Tracker — Training Data

This folder ships with the app and contains PNG reference images used by the
template-matching OCR engine.

## Structure

```
training-data/
  stats/              ← All 22 stat fields share this folder
    A++/
        A++.png           ← Non-dominant dragon: only this grade is shown
        A++_A.png         ← Dominant dragon: A++ visible, A recessive below
        A++_A-.png
        A++_B+.png
        ... (all recessive grades except A++ and A+)
    A+/
        A+.png
        A+_A.png
        A+_A-.png
        ...
    A/
        A.png
        A_A-.png
        ...
    ... (all grades down to F)

  bloodline_quality/  ← Capped at A (no A+ or A++)
    A/   A-/   B+/   B/   B-/   C+/   C/   C-/   D+/   D/   D-/   E/   F/

  alphabet/           ← Letter-by-letter name OCR
    A/ B/ … Z/   0/ 1/ … 9/   SPACE/   HYPHEN/

  gender/             M/   F/
  species/            FS/  SS/  ASD/  IR/  BS/  BW/  BIO/
  growth/             Hatchling/  Juvenile/  Adult/  Elder/
```

## How to add your own samples

1. Take a screenshot while playing Day of Dragons (F8 in the tracker, or manually)
2. Crop the relevant field region
3. Drop the PNG into the correct subfolder
4. Open Settings → Training Data → click Reload on that section

## Notes

- `A+` and `A++` **never** appear as recessive stats (game mechanic)
- `bloodline_quality` is capped at `A` — no `A+` or `A++` grades
- `Fighter` and `Breeder` are **not** in training data — they are internal meta tags only
- `growth` (`Hatchling`, `Juvenile`, `Adult`, `Elder`) comes from the stat screen — not `role`

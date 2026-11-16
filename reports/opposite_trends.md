# Opposite Trend Detector v2 — report

Store: `data/processed/analysis_real.json` (synthetic_demo=False) · months 1981-01..2026-10

A pair is kept only when **both** cells are Benjamini–Hochberg FDR-significant, slopes
have opposite signs, and min(|slope|) exceeds the per-variable minimum effect size.
Cells belonging to the same-sign contiguous patch are merged (8-neighbourhood, longitude
wraps at the dateline); patch pairs are ranked by magnitude × area.

**Null baseline**: the trend multiset is randomly permuted across the grid (destroys
spatial autocorrelation — a 'no spatial pattern' null). Counts are *cell-pairs*, not patch pairs.

## ndvi

- strong patch pairs reported: **0** (top 0 shown)
- eligible (FDR-significant, above effect size) cells: 0
- cell-pairs: **observed 0 vs random-permutation expected 0.0 ± 0.0** (p=1.0)
- verdict: no evidence of spatial clustering beyond chance

_No strong pairs found under the current FDR gate + effect size._

## precipitation

- strong patch pairs reported: **53** (top 10 shown)
- eligible (FDR-significant, above effect size) cells: 2665
- cell-pairs: **observed 326 vs random-permutation expected 1293.53 ± 29.83** (p=1.0)
- verdict: no evidence of spatial clustering beyond chance

### #1 — (76.2, 8.8) ↑ vs (61.2, -6.2) ↓

- slopes: +7.897 vs -16.431 precipitation/decade
- p (FDR): 0.0345 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 633 cells (mean +2.273) vs 78 cells (mean -5.787)
- rank score (magnitude × area): 2807.22
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #2 — (-71.2, 23.8) ↑ vs (-68.8, 123.8) ↓

- slopes: +9.283 vs -4.669 precipitation/decade
- p (FDR): 0.0000 vs 0.0146 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 104 cells (mean +3.371) vs 165 cells (mean -1.043)
- rank score (magnitude × area): 627.97
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #3 — (-76.2, 163.8) ↑ vs (-76.2, -131.2) ↓

- slopes: +5.636 vs -6.166 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 83 cells (mean +2.267) vs 71 cells (mean -2.462)
- rank score (magnitude × area): 433.98
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #4 — (-76.2, 163.8) ↑ vs (-88.8, -178.8) ↓

- slopes: +5.636 vs -5.622 precipitation/decade
- p (FDR): 0.0000 vs 0.0039 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 83 cells (mean +2.267) vs 35 cells (mean -3.673)
- rank score (magnitude × area): 331.69
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #5 — (76.2, 8.8) ↑ vs (81.2, -73.8) ↓

- slopes: +7.897 vs -0.922 precipitation/decade
- p (FDR): 0.0345 vs 0.0174 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 633 cells (mean +2.273) vs 1 cells (mean -0.922)
- rank score (magnitude × area): 292.38
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #6 — (-66.2, 108.8) ↑ vs (-68.8, 123.8) ↓

- slopes: +2.898 vs -4.669 precipitation/decade
- p (FDR): 0.0009 vs 0.0146 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 1 cells (mean +2.898) vs 165 cells (mean -1.043)
- rank score (magnitude × area): 240.51
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #7 — (76.2, 8.8) ↑ vs (78.8, -46.2) ↓

- slopes: +7.897 vs -0.653 precipitation/decade
- p (FDR): 0.0345 vs 0.0247 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 633 cells (mean +2.273) vs 1 cells (mean -0.653)
- rank score (magnitude × area): 206.88
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #8 — (-61.2, -178.8) ↑ vs (-73.8, 161.2) ↓

- slopes: +10.480 vs -3.088 precipitation/decade
- p (FDR): 0.0000 vs 0.0005 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 131 cells (mean +3.799) vs 3 cells (mean -1.977)
- rank score (magnitude × area): 206.87
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #9 — (11.2, 18.8) ↑ vs (6.2, 38.8) ↓

- slopes: +6.140 vs -7.524 precipitation/decade
- p (FDR): 0.0002 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 58 cells (mean +3.003) vs 6 cells (mean -5.220)
- rank score (magnitude × area): 196.48
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #10 — (11.2, 18.8) ↑ vs (6.2, -8.8) ↓

- slopes: +6.140 vs -7.302 precipitation/decade
- p (FDR): 0.0002 vs 0.0133 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 58 cells (mean +3.003) vs 2 cells (mean -6.697)
- rank score (magnitude × area): 184.20
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side


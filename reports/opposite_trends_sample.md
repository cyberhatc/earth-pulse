# Opposite Trend Detector v2 — report

Store: `data/processed/analysis.json` (synthetic_demo=True) · months 1985-01..2026-06

A pair is kept only when **both** cells are Benjamini–Hochberg FDR-significant, slopes
have opposite signs, and min(|slope|) exceeds the per-variable minimum effect size.
Cells belonging to the same-sign contiguous patch are merged (8-neighbourhood, longitude
wraps at the dateline); patch pairs are ranked by magnitude × area.

**Null baseline**: the trend multiset is randomly permuted across the grid (destroys
spatial autocorrelation — a 'no spatial pattern' null). Counts are *cell-pairs*, not patch pairs.

## ndvi

- strong patch pairs reported: **8** (top 8 shown)
- eligible (FDR-significant, above effect size) cells: 105
- cell-pairs: **observed 83 vs random-permutation expected 85.75 ± 7.42** (p=0.6716)
- verdict: no evidence of spatial clustering beyond chance

### #1 — (75.0, 30.0) ↑ vs (45.0, 90.0) ↓

- slopes: +0.086 vs -0.102 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 24 cells (mean +0.047) vs 20 cells (mean -0.053)
- rank score (magnitude × area): 1.89
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #2 — (75.0, -90.0) ↑ vs (45.0, -135.0) ↓

- slopes: +0.085 vs -0.091 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 21 cells (mean +0.045) vs 10 cells (mean -0.048)
- rank score (magnitude × area): 1.32
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #3 — (75.0, 30.0) ↑ vs (60.0, -30.0) ↓

- slopes: +0.086 vs -0.059 ndvi/decade
- p (FDR): 0.0000 vs 0.0007 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 24 cells (mean +0.047) vs 14 cells (mean -0.032)
- rank score (magnitude × area): 1.11
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #4 — (-15.0, 135.0) ↑ vs (45.0, 90.0) ↓

- slopes: +0.067 vs -0.102 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 12 cells (mean +0.034) vs 20 cells (mean -0.053)
- rank score (magnitude × area): 1.07
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #5 — (75.0, -90.0) ↑ vs (60.0, -30.0) ↓

- slopes: +0.085 vs -0.059 ndvi/decade
- p (FDR): 0.0000 vs 0.0007 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 21 cells (mean +0.045) vs 14 cells (mean -0.032)
- rank score (magnitude × area): 1.03
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #6 — (75.0, -90.0) ↑ vs (-30.0, -60.0) ↓

- slopes: +0.085 vs -0.033 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 21 cells (mean +0.045) vs 2 cells (mean -0.029)
- rank score (magnitude × area): 0.38
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #7 — (75.0, 30.0) ↑ vs (-15.0, -15.0) ↓

- slopes: +0.086 vs -0.029 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 24 cells (mean +0.047) vs 1 cells (mean -0.029)
- rank score (magnitude × area): 0.36
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

### #8 — (-15.0, 135.0) ↑ vs (-30.0, 120.0) ↓

- slopes: +0.067 vs -0.032 ndvi/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 12 cells (mean +0.034) vs 1 cells (mean -0.032)
- rank score (magnitude × area): 0.21
- candidate explanations (HYPOTHESES, not conclusions): Land-use change — cropland expansion/abandonment or reforestation on one side, Irrigation — greening where water is applied, decline where it is not, Drought severity gradient — rain shadow or continental gradient drying faster on one side, CO2 fertilisation — responding vegetation benefit without rainfall change

## precipitation

- strong patch pairs reported: **6** (top 6 shown)
- eligible (FDR-significant, above effect size) cells: 233
- cell-pairs: **observed 190 vs random-permutation expected 418.17 ± 13.61** (p=1.0)
- verdict: no evidence of spatial clustering beyond chance

### #1 — (-45.0, 90.0) ↑ vs (0.0, 150.0) ↓

- slopes: +13.806 vs -12.771 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 42 cells (mean +6.270) vs 36 cells (mean -5.375)
- rank score (magnitude × area): 498.09
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #2 — (45.0, -150.0) ↑ vs (0.0, 150.0) ↓

- slopes: +12.684 vs -12.771 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 41 cells (mean +6.650) vs 36 cells (mean -5.375)
- rank score (magnitude × area): 488.34
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #3 — (-45.0, -30.0) ↑ vs (0.0, -90.0) ↓

- slopes: +13.069 vs -12.186 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 44 cells (mean +6.009) vs 36 cells (mean -5.243)
- rank score (magnitude × area): 487.42
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #4 — (45.0, -150.0) ↑ vs (0.0, -90.0) ↓

- slopes: +12.684 vs -12.186 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 41 cells (mean +6.650) vs 36 cells (mean -5.243)
- rank score (magnitude × area): 469.14
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #5 — (-45.0, -30.0) ↑ vs (0.0, 15.0) ↓

- slopes: +13.069 vs -11.696 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 44 cells (mean +6.009) vs 34 cells (mean -5.590)
- rank score (magnitude × area): 456.13
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

### #6 — (-45.0, 90.0) ↑ vs (0.0, 15.0) ↓

- slopes: +13.806 vs -11.696 precipitation/decade
- p (FDR): 0.0000 vs 0.0000 · both FDR-significant: {'cell_a': True, 'cell_b': True}
- patches: 42 cells (mean +6.270) vs 34 cells (mean -5.590)
- rank score (magnitude × area): 444.43
- candidate explanations (HYPOTHESES, not conclusions): Monsoon shift — wind/pressure changes diverging the rain belt across the region, Irrigation expansion — local recycling/masking of regional rainfall signal, Land-use change — deforestation or agriculture altering evapotranspiration on one side, Aerosol forcing — asymmetric pollution suppressing rain on the drying side

*Note: this run used the synthetic demo store. Regenerate with the real store:*
```
python pipeline/build_store.py --fast && make real-analysis
python scripts/report_opposite_trends.py --analysis data/processed/analysis_real.json
```


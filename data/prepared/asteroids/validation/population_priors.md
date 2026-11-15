# Population priors: model comparison

Training: 139025 catalogue diameters, 1470 SMASSII-classified objects; 201 designations excluded (validation targets, injection set). 5-fold cross-validation; errors in log10 D.

## Albedo regression (a, e, sin i, H -> log10 pV)

| Model | rms log10 D | robust sigma | within 20% | within 50% |
|---|---|---|---|---|
| constant (median pV) | 0.171 | 0.155 | 0.41 | 0.88 |
| Ridge (linear) | 0.152 | 0.151 | 0.33 | 0.90 |
| MLP (64, 32) | 0.112 | 0.102 | 0.60 | 0.94 |
| Random forest | 0.107 | 0.090 | 0.65 | 0.94 |
| Gradient boosting (HistGB, adopted) | 0.106 | 0.094 | 0.63 | 0.95 |

Permutation importance (increase of MSE in log10 pV when the feature is shuffled): a 0.0770, H 0.0584, sin_i 0.0131, e 0.0090

## Albedo of a complex (SMASSII objects with a diameter, n = 1237)

| Predictor | rms log10 D | robust sigma | within 20% | within 50% |
|---|---|---|---|---|
| orbit regression only | 0.148 | 0.154 | 0.43 | 0.85 |
| complex median only | 0.113 | 0.069 | 0.71 | 0.92 |
| complex + orbit, inverse-variance (adopted) | 0.107 | 0.084 | 0.67 | 0.93 |

| Complex (adopted predictor) | n | rms log10 D | within 20% |
|---|---|---|---|
| A-type | 13 | 0.068 | 0.85 |
| C-complex | 373 | 0.109 | 0.60 |
| D-type | 8 | 0.091 | 0.50 |
| K-type | 30 | 0.067 | 0.83 |
| L-type | 39 | 0.093 | 0.67 |
| O-type | 4 | 0.183 | 0.00 |
| Q-type | 8 | 0.122 | 0.25 |
| R-type | 4 | 0.042 | 1.00 |
| S-complex | 492 | 0.063 | 0.88 |
| T-type | 9 | 0.080 | 0.78 |
| V-type | 28 | 0.065 | 0.89 |
| X-complex | 229 | 0.171 | 0.31 |

## Complex frequency along the orbit (a, e, sin i, H -> complex)

| Model | log-loss | accuracy |
|---|---|---|
| base rates only | 1.530 | 0.431 |
| Logistic regression | 1.468 | 0.478 |
| Decision tree | 1.509 | 0.488 |
| SVM (RBF) | 1.436 | 0.472 |
| k nearest neighbours (25) | 1.601 | 0.495 |
| Gradient boosting (HistGB) | 1.483 | 0.516 |
| Random forest (leaf 5) | 1.293 | 0.548 |
| Random forest (leaf 15, adopted) | 1.297 | 0.531 |

Permutation importance (increase of log-loss): a 0.2766, e 0.0576, sin_i 0.0480, H 0.0408

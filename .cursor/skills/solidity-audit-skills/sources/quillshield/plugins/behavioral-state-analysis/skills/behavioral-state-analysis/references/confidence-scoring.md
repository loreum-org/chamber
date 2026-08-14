# Confidence Scoring Deep-Dive Reference

> **Optional reference.** Only read this file when you need detailed scoring examples or FP rate estimation guidance beyond what SKILL.md provides.

## Formula

`Confidence = (Evidence_Strength × Exploit_Feasibility × Impact_Severity) / False_Positive_Rate`

## Evidence Strength (0-1)

| Score | Criteria |
|-------|----------|
| 1.0 | Concrete code path, no external dependencies |
| 0.7 | Path depends on specific but achievable state |
| 0.4 | Pattern-based theoretical vulnerability |
| 0.1 | Heuristic suggestion without concrete evidence |

## Exploit Feasibility (0-1)

| Score | Criteria |
|-------|----------|
| 1.0 | PoC confirmed and executes successfully |
| 0.7 | Requires specific achievable contract state |
| 0.4 | Requires external conditions (oracle manipulation, MEV infra) |
| 0.1 | Theoretically possible, practically infeasible |

## Impact Severity (1-5)

5=Complete fund loss/system compromise, 4=Partial loss/privesc, 3=Griefing/DOS, 2=Info leak, 1=Best practice

## False Positive Rate Estimation

- 0.05: Well-known patterns (reentrancy without guard)
- 0.15: Moderate patterns (access control gaps)
- 0.40: Weak patterns (potential front-running)
- 0.60: Heuristic suggestions

## Quick Examples

- Reentrancy in withdraw (E=1.0, F=1.0, I=5, FP=0.05) → 100 → cap at 99%
- Front-running auction (E=0.7, F=0.6, I=3, FP=0.3) → 4.2 → 42%
- Gas optimization (E=0.4, F=0.1, I=1, FP=0.5) → 0.08 → 8%

## Prioritization

- Report all ≥10% confidence
- Highlight ≥70% as Critical
- 30-70% flagged for review
- <30% in appendix
- Never suppress Impact ≥4 regardless of confidence

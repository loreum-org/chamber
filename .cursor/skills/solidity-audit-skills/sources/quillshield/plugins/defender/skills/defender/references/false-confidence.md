# False Confidence Warnings

Passing these does not prove deploy safety:
- unit tests
- `forge test`
- static analysis
- lint
- typecheck

## Why
These signals mostly validate code correctness or style under expected conditions. They do not validate:
- target chain correctness
- signer correctness
- role transfer correctness
- post-deploy config correctness
- upgrade execution safety
- source verification readiness

## Stronger deployment evidence
- fork rehearsal
- permission diff before and after deployment
- storage layout diff
- expected address diff
- event assertions
- role inventory snapshot
- smoke tests against deployed state

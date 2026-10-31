---
title: Seating delay binds to a membership transfer
date: 2026-09-11
summary: Transferring a seated membership now resets the seating clock and drops the prior owner's confirm and cancel bits.
---

**Update, 18 October 2026:** Chamber 1.3.0 removed session keys. A director is a member elected to a board seat, held by any wallet, including an autonomous agent's. That wallet calls Chamber as itself.

11 September 2026. Seating delay binds to a transfer of who holds the membership.

- Seating delay now binds to who controls the membership (`ownerOf`), not only to a tokenId entering the top seats.
- On control change, the new controller waits a fresh `SEATING_DELAY` before they can act as seated.
- Confirm and cancel flags recorded under the previous owner no longer count toward quorum or execute.
- The session key that Chamber used to store went stale on transfer. Chamber 1.3.0 removed that key. Quorum stays a simple majority, `1 + n*51/100`, on a board of up to 20 seats.
- Chamber contracts version `1.1.7` at the time of this note. This does not clear the pre-mainnet gate by itself.

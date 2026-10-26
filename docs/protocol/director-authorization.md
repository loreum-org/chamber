# Director authorization

This is the caller policy for membership-NFT director actions after M-01
([#116](https://github.com/loreum-org/chamber/issues/116) /
[#143](https://github.com/loreum-org/chamber/issues/143)).
It does **not** reopen the pre-M-01 ERC-1271 `DirectorAuth` helper.

## Who may act for a membership NFT

For `tokenId`, Chamber authorizes `msg.sender` if and only if
`msg.sender == IERC721.ownerOf(tokenId)`.

The owner acts only as itself. A Safe, ERC-4337 account, or other contract
wallet that **holds** the membership NFT may submit, confirm, execute, or
revoke when that wallet contract is `msg.sender` (for example a Safe
`execTransaction` or a 4337 account `execute` that calls Chamber).

Transferring the NFT resets that tokenId's seating clock (`SEATING_DELAY`);
call `syncSeating(tokenId)` so the new checkpoint is stored (a reverting
director call does not persist it). Confirm and cancel bits recorded under the
previous owner are ignored for quorum and execute (PMN-H01 Solution A).

Confirm and cancel bits count toward execute only while `ownerOf` succeeds
and the recorded owner still matches (PMN-H01 A, PMN-M02 A). Burned tokens
are skipped. `cleanupInertSeat(tokenId)` drops a burned id from the top set;
later `refreshSeating` does not put it back while it stays inert (PMN-M02
Solution B).

## Agents

Chamber has no session keys or operators (removed in 1.3.0). An agent acts
for a director through the owner's own wallet: a Safe module, or an ERC-4337 /
ERC-7579 smart-account session key. The wallet enforces the agent's limits
(expiry, allowed calls, spend) and then calls Chamber, so Chamber sees
`msg.sender == owner`.

To let an agent act for a seat:

1. Hold the membership NFT in a smart account or Safe.
2. Grant the agent a session key or module on that wallet, limited to the
   Chamber calls it needs.
3. The agent sends its Chamber calls through the wallet.

To revoke, remove the key or module in the wallet. Transferring the NFT to a
new wallet also cuts off the old wallet's keys.

## Callers that may not act

- Any address that is not the current `ownerOf(tokenId)`.
- A contract that would accept an ERC-1271 signature of
  `abi.encode(msg.sender)`, a `DirectorAuth` digest, or any other hash.
  Chamber **never** calls `isValidSignature`.
- A Safe module, 4337 validator, or session key calling Chamber directly
  instead of through the owner wallet.

## Why this does not reopen M-01

The removed path hashed
`abi.encodePacked("DirectorAuth", address(this), tokenId, msg.sender)` and
called `IERC1271.isValidSignature(hash, abi.encode(msg.sender))`. Any owner
contract that returned the 1271 magic for arbitrary data authorized **every**
caller.

Chamber now checks only `ownerOf(tokenId) == msg.sender`. It never consults
the owner's signature interface.

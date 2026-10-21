# Director authorization

This is the caller policy for membership-NFT director actions after M-01
([#116](https://github.com/loreum-org/chamber/issues/116) /
[#143](https://github.com/loreum-org/chamber/issues/143)).
It does **not** reopen the pre-M-01 ERC-1271 `DirectorAuth` helper.

## Who may act for a membership NFT

For `tokenId`, Chamber authorizes `msg.sender` only when
`msg.sender == IERC721.ownerOf(tokenId)`.

The owner can be an EOA or a contract wallet. A Safe, ERC-4337 account, or
other contract wallet that **holds** the membership NFT may submit, confirm,
execute, revoke, or cancel when that wallet is `msg.sender` (for example a
Safe `execTransaction` or a 4337 account `execute` that calls Chamber).

Seat-gated actions also need the token in the top seats, and a newly seated
token (or a control transfer of a seated token) waits `SEATING_DELAY`
(1 block) before director actions apply.

Confirm and cancel bits count toward execute only while `ownerOf` succeeds
and the recorded controller still matches (PMN-H01 A, PMN-M02 A). Burned
tokens are skipped. `cleanupInertSeat(tokenId)` drops a burned id from the
top set; later `refreshSeating` does not put it back while it stays inert
(PMN-M02 Solution B).

## Agents and automation

Chamber has no session keys or operator allowlist. Chamber session keys
(`setDirectorOperator`) were removed in **1.3.0**.

To let an agent act for a seat, give it a key on the **owner wallet**: a Safe
module, or a session key on an ERC-4337 / ERC-7579 smart account. The agent's
call reaches Chamber through that wallet, so Chamber sees
`msg.sender == ownerOf(tokenId)`. Limits on what the agent may do live in the
wallet, not in Chamber.

## Callers that may not act

- Any address that is not the current `ownerOf(tokenId)`.
- A contract that would accept an ERC-1271 signature of
  `abi.encode(msg.sender)`, a `DirectorAuth` digest, or any other hash.
  Chamber **never** calls `isValidSignature`.
- Safe modules, ERC-4337 validators, or off-chain keys that call Chamber
  directly instead of through the owner wallet.

## Why this does not reopen M-01

The removed path hashed
`abi.encodePacked("DirectorAuth", address(this), tokenId, msg.sender)` and
called `IERC1271.isValidSignature(hash, abi.encode(msg.sender))`. Any owner
contract that returned the 1271 magic for arbitrary data authorized **every**
caller.

Chamber now checks only `ownerOf(tokenId) == msg.sender`. It never consults
the owner's signature interface.

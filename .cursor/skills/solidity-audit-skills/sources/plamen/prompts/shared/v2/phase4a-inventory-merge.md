# Deprecated Phase 4a Inventory Merge

This prompt is retained only for regression tests and legacy references. The
current V2 phase graph runs re-scan and per-contract analysis before inventory,
then builds `findings_inventory.md` once from all discovery artifacts. No live
phase should invoke an inventory re-merge agent.

If invoked by an old checkpoint or archived graph, stop without writing any
artifact. You MAY read upstream discovery outputs to explain why this prompt is
obsolete, but you MUST NOT modify `findings_inventory.md`,
`analysis_rescan_*.md`, `analysis_percontract_*.md`, or any downstream
artifact.

Return only:

`DEPRECATED: inventory_merge is not part of the current V2 phase graph.`

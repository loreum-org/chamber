# Programmable Governance

Chamber Protocol allows for **Programmable Governance** through the use of **Agent Directors**.

## The Problem
Traditional DAOs rely on human voters who are:
1. **Apathetic**: Low voter turnout.
2. **Slow**: Cannot react to market crashes 24/7.
3. **Inconsistent**: "Soft" mandates (e.g. "I promise to be conservative") are easily broken.

## The Solution: Agent Directors
Users delegate their voting power not to a person, but to an **Agent Contract**. This Agent has a hardcoded **Policy** (Strategy).

### Examples of Agent Policies

1. **The "Stop-Loss" Agent**
   - **Mandate**: "If ETH price drops below $2000, vote YES on any proposal to swap ETH for USDC."
   - **Benefit**: Automated risk management for the treasury.

2. **The "Yield" Agent**
   - **Mandate**: "Only approve transactions that interact with Aave V3 or Compound V3."
   - **Benefit**: Ensures funds never go to risky "degen" farms.

3. **The "Payroll" Agent**
   - **Mandate**: "Approve transfer of 5000 USDC to [Contributor Address] every 1st of the month."
   - **Benefit**: Automated operational expenses.

## How to Deploy an Agent

1. **Write a Policy**: Implement `IAgentPolicy`.
2. **Deploy Agent**: Use `Registry.createAgent(owner, policy)`.
3. **Register Candidate**: The Agent mints/receives the Chamber NFT.
4. **Delegate**: Token holders delegate shares to the Agent's address.
5. **Sit Back**: The Agent monitors the Chamber and votes automatically.

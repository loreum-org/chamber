# Security Policy

## Reporting a Vulnerability

Plamen is a security auditing tool — we take vulnerabilities in our own tooling seriously.

If you discover a security vulnerability in Plamen's pipeline, MCP server, or wrapper code, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Use [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) to report privately via the repository's "Security" tab → "Report a vulnerability"
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Scope

The following are in scope for security reports:

- **MCP server vulnerabilities** (unified-vuln-db, slither-analyzer) — command injection, path traversal, data leakage
- **Pipeline prompt injection** — inputs that cause agents to exfiltrate data, bypass safety checks, or produce malicious output
- **Credential exposure** — API keys, private keys, or secrets leaked through logs, artifacts, or reports
- **Wrapper code** (plamen.py) — command injection via user inputs passed to subprocess

The following are **out of scope**:

- False positives/negatives in audit findings (these are quality issues, not security bugs)
- LLM hallucinations or reasoning errors (inherent to the underlying model)
- Issues in third-party dependencies (report upstream)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity, but we aim for Critical within 72 hours

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < Latest | Best effort |

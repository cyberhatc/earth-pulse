# Security Policy

## Supported versions

Earth Pulse is an open-source project under active development. This repository does not publish a formal list of supported versions or a guaranteed security response SLA.

## Reporting a vulnerability

If you believe you have found a security vulnerability:

- **Do not** publicly disclose exploit details, secrets, credentials, tokens, private keys, or personal data.
- **Do not** include sensitive information in screenshots, logs, or issue descriptions.
- If **GitHub private vulnerability reporting** is available for this repository, prefer using it.
- If private reporting is not available, contact the maintainers through the repository’s GitHub page and share only the minimum information needed to reproduce the issue. Coordinate a private follow-up channel if possible before sharing sensitive details.

> This repository does not currently document a dedicated security contact email or disclosure process beyond the guidance above.

## Scope notes

Examples of issues worth reporting include (non-exhaustive): exposed secrets, insecure default configurations, injection risks in exposed interfaces, unsafe handling of untrusted input, and dependency vulnerabilities with a plausible impact on this project.

When reporting, please include (if safe to share): affected component/path, reproduction steps, expected vs actual behavior, impact assessment, and any suggested mitigation.

## Secrets and credentials

- Never commit `.env` files or credentials.
- Use environment variables / secret stores provided by your deployment platform.
- Rotate any credential that may have been exposed.
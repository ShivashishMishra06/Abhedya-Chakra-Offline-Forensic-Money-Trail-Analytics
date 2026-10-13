# Abhedya-Chakra Launch Checklist

Pre-flight launch and deployment verification for the Abhedya-Chakra Forensic Analytics Engine.

## Checklist Items

- [ ] **Custom Domain Connected**
  - **DNS Steps**:
    1. Log in to your DNS registrar or DNS management console.
    2. Add an `A` record pointing your domain or subdomain to the assigned server/ingress IP address.
    3. Add a `CNAME` record for `www` (or alias) pointing to your canonical hostname.
    4. Wait for DNS propagation (typically 5 to 60 minutes) and verify with `dig yourdomain.com +nostats +nocomments`.
    5. Provision or verify the SSL/TLS certificate via Let's Encrypt or your cloud platform's managed certificates.

- [x] **Favicon and App Icons**
  - Verified: `public/favicon.svg` (crisp geometric mark), `public/favicon-32.png` (32x32 PNG), `public/apple-touch-icon.png` (180x180 PNG), and `public/site.webmanifest` created and linked in `index.html`.

- [x] **No AI Badges or Watermarks**
  - Verified in code: Zero "Made with AI", "Built with AI", or vendor watermark strings in codebase, templates, footer, or metadata.
  - **Important Hosting Reminder**: Ensure that any third-party hosting platform badges (for example "Built on platform" badges injected by some preview providers) are toggled off in your platform project settings.

- [x] **Privacy Policy Page**
  - Architecture-accurate privacy page created under route `#/privacy`.
  - Accurately details zero cloud compute, all data streams processed in memory/Web Workers locally on the client device, zero persistent remote uploads, zero tracking cookies, zero analytics. Explains `localStorage` usage for user-defined heuristic weights and provides a 1-click storage reset.

- [x] **Terms and Conditions Page**
  - Terms page created under route `#/terms`.
  - Clarifies intended operation for authorized law enforcement officers, cybercrime forensic investigators, and hackathon evaluation panels. Stipulates human verification requirements for Section 91 CrPC / Section 94 BNSS notices, non-legal-advice disclaimer, and limitation of liability.

## Configuration Values for Owner to Fill

Before deploying to a public or departmental law enforcement server, review and update `src/config/site.ts`:

1. `contactEmail`: Insert official departmental inquiry email (e.g., `cybercell-indore@mp.gov.in`). If kept empty, the contact line is automatically suppressed from the UI.
2. `organization`: Default set to "Indore Police Commissionerate".
3. `department`: Default set to "1930 Financial Cybercrime Investigation Unit".

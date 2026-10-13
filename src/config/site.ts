export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  organization: string;
  department: string;
  event: string;
  contactEmail: string; // If empty, hide contact line in UI
  version: string;
}

export const siteConfig: SiteConfig = {
  name: 'Abhedya-Chakra Forensic Analytics Engine',
  shortName: 'Abhedya-Chakra',
  tagline: 'High-Throughput Mule Ring Detection and Legal Freeze Requisition',
  organization: 'Indore Police Commissionerate',
  department: '1930 Financial Cybercrime Investigation Unit',
  event: 'Void Hacks() 8.0 - Theme Abhedya',
  contactEmail: '', // Left blank per launch instructions; owner may populate
  version: '1.0.0',
};

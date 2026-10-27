const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DNS_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DATAVERSE_HOST_RE = new RegExp(
  `^${DNS_LABEL}\\.(?:crm[0-9]*\\.dynamics\\.com|crm\\.(?:microsoftdynamics\\.us|appsplatform\\.us|dynamics\\.cn))$`,
  "i"
);
const TENANT_DOMAIN_RE = new RegExp(`^(?:${DNS_LABEL}\\.)+[a-z]{2,63}$`, "i");

function validateTenantId(value) {
  if (typeof value !== "string" || !(GUID_RE.test(value) || TENANT_DOMAIN_RE.test(value))) {
    throw new Error("Tenant ID must be a GUID or tenant domain name.");
  }
  return value;
}

function validateAgentId(value) {
  if (typeof value !== "string" || !GUID_RE.test(value)) {
    throw new Error("Agent ID must be a GUID.");
  }
  return value;
}

function validateDataverseUrl(value) {
  // Check the original spelling too: URL parsing normalizes backslashes and dot segments.
  if (typeof value !== "string" || !/^https:\/\/[^/?#\\\s]+\/*$/i.test(value)) {
    throw new Error("Dataverse URL must be an HTTPS origin without a path, query, or fragment.");
  }
  const url = new URL(value);
  if (url.username || url.password || url.port || !DATAVERSE_HOST_RE.test(url.hostname)) {
    throw new Error("Dataverse URL must use a trusted Dataverse hostname and the default HTTPS port.");
  }
  return url.origin;
}

module.exports = { validateTenantId, validateAgentId, validateDataverseUrl };

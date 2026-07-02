// Verifies NIN format first, then delegates to the configured live provider when available.
export async function verifyNin(nin: string) {
  if (!/^\d{11}$/.test(nin)) {
    return { verified: false, reason: "NIN must be exactly 11 digits" };
  }

  if (!process.env.NIN_VERIFICATION_API_URL || !process.env.NIN_VERIFICATION_API_KEY) {
    return {
      verified: false,
      reason: "Live NIN provider is not configured. Add NIN_VERIFICATION_API_URL and NIN_VERIFICATION_API_KEY."
    };
  }

  const response = await fetch(process.env.NIN_VERIFICATION_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NIN_VERIFICATION_API_KEY}`
    },
    body: JSON.stringify({ nin })
  });

  if (!response.ok) return { verified: false, reason: "NIN provider rejected the verification request" };
  const payload = await response.json() as { valid?: boolean; verified?: boolean; message?: string };
  return {
    verified: Boolean(payload.valid ?? payload.verified),
    reason: payload.message
  };
}

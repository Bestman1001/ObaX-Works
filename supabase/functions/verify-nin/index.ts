import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerificationResult = {
  status: "pending" | "verified" | "failed";
  reference: string;
  message: string;
  providerResponse?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const applicationCode = String(body.application_code || "").trim();
    const applicantEmail = String(body.applicant_email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const phone = String(body.phone || "").trim();
    const nin = String(body.nin || "").trim();
    const consent = body.consent === true;
    const livenessConsent = body.liveness_consent === true;
    const selfieMediaPaths = Array.isArray(body.selfie_media_paths)
      ? body.selfie_media_paths.map((path) => String(path || "").trim()).filter(Boolean).slice(0, 2)
      : [];

    if (!applicationCode || !applicantEmail || !fullName || !phone) {
      return json({ error: "Application code, email, name, and phone are required." }, 400);
    }

    if (!/^\d{11}$/.test(nin)) {
      return json({ error: "NIN must be 11 digits." }, 400);
    }

    if (!consent) {
      return json({ error: "Identity verification consent is required." }, 400);
    }

    if (!livenessConsent || !selfieMediaPaths.length) {
      return json({ error: "Selfie/liveness proof and consent are required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase service credentials are not configured." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const selfieMediaUrls = await createVerificationProofUrls(supabaseAdmin, selfieMediaPaths);
    const result = await verifyWithProvider({ nin, fullName, phone, applicantEmail, selfieMediaPaths, selfieMediaUrls });
    const now = new Date().toISOString();

    const updatePayload = {
      nin_last4: nin.slice(-4),
      nin_consent: true,
      nin_consent_at: now,
      liveness_consent: true,
      liveness_consent_at: now,
      verification_media_count: selfieMediaPaths.length,
      identity_verification_status: result.status,
      identity_verification_reference: result.reference,
    };

    const { data, error } = await supabaseAdmin
      .from("artisan_applications")
      .update(updatePayload)
      .eq("application_code", applicationCode)
      .eq("applicant_email", applicantEmail)
      .select(
        "application_code, applicant_email, identity_verification_status, identity_verification_reference",
      )
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    await supabaseAdmin.from("identity_verification_attempts").insert({
      application_code: applicationCode,
      applicant_email: applicantEmail,
      nin_last4: nin.slice(-4),
      liveness_media_count: selfieMediaPaths.length,
      provider: providerName(),
      provider_reference: result.reference,
      status: result.status,
      message: result.message,
      response_summary: summarizeProviderResponse(result.providerResponse),
    });

    return json({
      application: data,
      status: result.status,
      reference: result.reference,
      message: result.message,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Verification failed." }, 500);
  }
});

async function verifyWithProvider(input: {
  nin: string;
  fullName: string;
  phone: string;
  applicantEmail: string;
  selfieMediaPaths: string[];
  selfieMediaUrls: string[];
}): Promise<VerificationResult> {
  const mode = Deno.env.get("NIN_PROVIDER_MODE") || Deno.env.get("IDENTITY_PROVIDER_MODE") || "pending";
  const reference = `identity-${crypto.randomUUID()}`;

  if (mode === "mock") {
    return {
      status: "verified",
      reference,
      message: "Mock NIN + selfie/liveness verification passed. Replace mock mode before production launch.",
    };
  }

  if (providerName() === "qoreid" || Deno.env.get("QOREID_CLIENT_ID")) {
    return verifyWithQoreId(input, reference);
  }

  const providerUrl = Deno.env.get("NIN_PROVIDER_URL") || Deno.env.get("IDENTITY_PROVIDER_URL");
  const providerKey = Deno.env.get("NIN_PROVIDER_API_KEY") || Deno.env.get("IDENTITY_PROVIDER_API_KEY");
  const authHeader = Deno.env.get("NIN_PROVIDER_AUTH_HEADER") || Deno.env.get("IDENTITY_PROVIDER_AUTH_HEADER") || "Authorization";

  if (!providerUrl || !providerKey) {
    return {
      status: "pending",
      reference,
      message: "Identity provider is not configured yet.",
    };
  }

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [authHeader]: authHeader.toLowerCase() === "authorization" ? `Bearer ${providerKey}` : providerKey,
    },
    body: JSON.stringify({
      nin: input.nin,
      full_name: input.fullName,
      phone: input.phone,
      email: input.applicantEmail,
      selfie_media_paths: input.selfieMediaPaths,
      selfie_media_urls: input.selfieMediaUrls,
      liveness_consent: true,
      consent: true,
    }),
  });

  const providerResponse = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      status: "failed",
      reference,
      message: `Provider request failed with HTTP ${response.status}.`,
      providerResponse,
    };
  }

  const normalized = normalizeProviderResponse(providerResponse);
  return {
    status: normalized.status,
    reference: normalized.reference || reference,
    message: normalized.message,
    providerResponse,
  };
}

async function verifyWithQoreId(
  input: {
    nin: string;
    fullName: string;
    phone: string;
    applicantEmail: string;
    selfieMediaPaths: string[];
    selfieMediaUrls: string[];
  },
  fallbackReference: string,
): Promise<VerificationResult> {
  const clientId = Deno.env.get("QOREID_CLIENT_ID");
  const clientSecret = Deno.env.get("QOREID_CLIENT_SECRET");
  const baseUrl = Deno.env.get("QOREID_BASE_URL") || "https://api.qoreid.com";

  if (!clientId || !clientSecret) {
    return {
      status: "pending",
      reference: fallbackReference,
      message: "QoreID client credentials are not configured yet.",
    };
  }

  if (!input.selfieMediaUrls.length) {
    return {
      status: "failed",
      reference: fallbackReference,
      message: "Selfie/liveness proof could not be prepared for QoreID.",
    };
  }

  const tokenResponse = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      clientId,
      secret: clientSecret,
    }),
  });

  const tokenPayload = await parseProviderJson(tokenResponse);

  if (!tokenResponse.ok) {
    return {
      status: "failed",
      reference: fallbackReference,
      message: `QoreID token request failed with HTTP ${tokenResponse.status}.`,
      providerResponse: tokenPayload,
    };
  }

  const accessToken = extractAccessToken(tokenPayload);
  if (!accessToken) {
    return {
      status: "failed",
      reference: fallbackReference,
      message: "QoreID token response did not include an access token.",
      providerResponse: tokenPayload,
    };
  }

  const verificationResponse = await fetch(`${baseUrl}/v1/ng/identities/face-verification/nin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      idNumber: input.nin,
      photoUrl: input.selfieMediaUrls[0],
    }),
  });

  const providerResponse = await parseProviderJson(verificationResponse);

  if (!verificationResponse.ok) {
    return {
      status: "failed",
      reference: fallbackReference,
      message: `QoreID NIN face verification failed with HTTP ${verificationResponse.status}.`,
      providerResponse,
    };
  }

  const normalized = normalizeProviderResponse(providerResponse);
  return {
    status: normalized.status,
    reference: normalized.reference || fallbackReference,
    message: normalized.message,
    providerResponse,
  };
}

async function createVerificationProofUrls(supabaseAdmin: ReturnType<typeof createClient>, paths: string[]) {
  const urls: string[] = [];

  for (const path of paths) {
    const { data, error } = await supabaseAdmin.storage
      .from("fixam-verification")
      .createSignedUrl(path, 60 * 10);

    if (!error && data?.signedUrl) {
      urls.push(data.signedUrl);
    }
  }

  return urls;
}

async function parseProviderJson(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text.slice(0, 500) };
  }
}

function extractAccessToken(response: unknown) {
  if (!response || typeof response !== "object") return "";

  const source = response as Record<string, unknown>;
  return String(
    source.accessToken ||
      source.access_token ||
      source.token ||
      source.bearerToken ||
      source.jwt ||
      "",
  );
}

function normalizeProviderResponse(response: Record<string, unknown>) {
  const nestedStatus = typeof response.status === "object" && response.status
    ? (response.status as Record<string, unknown>)
    : {};
  const faceCheck = typeof response.summary === "object" && response.summary
    ? (response.summary as Record<string, unknown>).face_verification_check
    : null;
  const faceMatch = typeof faceCheck === "object" && faceCheck
    ? (faceCheck as Record<string, unknown>).match
    : null;
  const statusValue = String(
    response.status ||
      response.verification_status ||
      nestedStatus.status ||
      nestedStatus.state ||
      "",
  ).toLowerCase();
  const verified =
    response.verified === true ||
    response.success === true ||
    faceMatch === true ||
    statusValue === "verified" ||
    statusValue === "success" ||
    statusValue === "complete" ||
    statusValue === "matched";

  const failed =
    response.verified === false ||
    faceMatch === false ||
    statusValue === "failed" ||
    statusValue === "rejected" ||
    statusValue === "not_found";

  const reference = String(response.reference || response.request_id || response.transaction_id || response.id || "");
  const message = String(response.message || response.description || "");

  return {
    status: verified ? "verified" : failed ? "failed" : "pending",
    reference,
    message: message || (verified ? "Identity verification passed." : failed ? "Identity verification failed." : "Identity verification is pending."),
  } as VerificationResult;
}

function summarizeProviderResponse(response: unknown) {
  if (!response || typeof response !== "object") return {};

  const source = response as Record<string, unknown>;
  const status = typeof source.status === "object" && source.status
    ? (source.status as Record<string, unknown>)
    : {};
  const summary = typeof source.summary === "object" && source.summary
    ? (source.summary as Record<string, unknown>)
    : {};
  const faceCheck = typeof summary.face_verification_check === "object" && summary.face_verification_check
    ? (summary.face_verification_check as Record<string, unknown>)
    : {};

  return {
    status: status.status || status.state || source.status || source.verification_status || null,
    verified: source.verified ?? source.success ?? null,
    face_match: faceCheck.match ?? null,
    match_score: faceCheck.match_score ?? null,
    reference: source.reference || source.request_id || source.transaction_id || source.id || null,
    message: source.message || source.description || null,
  };
}

function providerName() {
  if (Deno.env.get("NIN_PROVIDER_MODE") === "mock" || Deno.env.get("IDENTITY_PROVIDER_MODE") === "mock") return "mock";
  return Deno.env.get("NIN_PROVIDER_NAME") || Deno.env.get("IDENTITY_PROVIDER_NAME") || "configured_provider";
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

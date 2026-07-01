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

    if (!applicationCode || !applicantEmail || !fullName || !phone) {
      return json({ error: "Application code, email, name, and phone are required." }, 400);
    }

    if (!/^\d{11}$/.test(nin)) {
      return json({ error: "NIN must be 11 digits." }, 400);
    }

    if (!consent) {
      return json({ error: "Identity verification consent is required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase service credentials are not configured." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const result = await verifyWithProvider({ nin, fullName, phone, applicantEmail });
    const now = new Date().toISOString();

    const updatePayload = {
      nin_last4: nin.slice(-4),
      nin_consent: true,
      nin_consent_at: now,
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
}): Promise<VerificationResult> {
  const mode = Deno.env.get("NIN_PROVIDER_MODE") || "pending";
  const reference = `nin-${crypto.randomUUID()}`;

  if (mode === "mock") {
    return {
      status: "verified",
      reference,
      message: "Mock verification passed. Replace mock mode before production launch.",
    };
  }

  const providerUrl = Deno.env.get("NIN_PROVIDER_URL");
  const providerKey = Deno.env.get("NIN_PROVIDER_API_KEY");
  const authHeader = Deno.env.get("NIN_PROVIDER_AUTH_HEADER") || "Authorization";

  if (!providerUrl || !providerKey) {
    return {
      status: "pending",
      reference,
      message: "NIN provider is not configured yet.",
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

function normalizeProviderResponse(response: Record<string, unknown>) {
  const statusValue = String(response.status || response.verification_status || "").toLowerCase();
  const verified =
    response.verified === true ||
    response.success === true ||
    statusValue === "verified" ||
    statusValue === "success" ||
    statusValue === "matched";

  const failed =
    response.verified === false ||
    statusValue === "failed" ||
    statusValue === "rejected" ||
    statusValue === "not_found";

  const reference = String(response.reference || response.request_id || response.transaction_id || "");
  const message = String(response.message || response.description || "");

  return {
    status: verified ? "verified" : failed ? "failed" : "pending",
    reference,
    message: message || (verified ? "NIN verification passed." : failed ? "NIN verification failed." : "NIN verification is pending."),
  } as VerificationResult;
}

function summarizeProviderResponse(response: unknown) {
  if (!response || typeof response !== "object") return {};

  const source = response as Record<string, unknown>;
  return {
    status: source.status || source.verification_status || null,
    verified: source.verified ?? source.success ?? null,
    reference: source.reference || source.request_id || source.transaction_id || null,
    message: source.message || source.description || null,
  };
}

function providerName() {
  if (Deno.env.get("NIN_PROVIDER_MODE") === "mock") return "mock";
  return Deno.env.get("NIN_PROVIDER_NAME") || "configured_provider";
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

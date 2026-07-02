import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fixam-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SupabaseAdmin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return json({ ok: true, service: "FixAm 9ja QoreID webhook" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("QOREID_WEBHOOK_SECRET") || "";
    if (webhookSecret && !hasValidWebhookSecret(req, webhookSecret)) {
      return json({ error: "Unauthorized webhook." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase service credentials are not configured." }, 500);
    }

    const references = uniqueStrings(extractReferenceCandidates(body));
    const normalizedStatus = normalizeQoreIdStatus(body);
    const providerMessage = extractProviderMessage(body);

    if (!references.length) {
      return json({
        ok: true,
        ignored: true,
        message: "Webhook endpoint is ready. No QoreID reference was found in this payload.",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const application = await findApplicationByReferences(supabaseAdmin, references);

    if (!application) {
      return json({
        ok: true,
        ignored: true,
        references,
        message: "Webhook received, but no matching artisan application was found.",
      });
    }

    const now = new Date().toISOString();
    const status = normalizedStatus === "verified" ? "verified" : normalizedStatus === "failed" ? "failed" : "pending";
    const reference = references[0];

    await supabaseAdmin.from("identity_verification_attempts").insert({
      application_code: application.application_code,
      applicant_email: application.applicant_email,
      nin_last4: application.nin_last4,
      liveness_media_count: Number(application.verification_media_count || 0),
      provider: "qoreid",
      provider_reference: reference,
      status,
      message: providerMessage || `QoreID webhook marked verification as ${status}.`,
      response_summary: summarizeWebhook(body),
    });

    const applicationUpdate: Record<string, unknown> = {
      identity_verification_status: status,
      identity_verification_reference: reference,
    };

    if (status === "verified") {
      applicationUpdate.status = "approved";
    }

    const { error: applicationError } = await supabaseAdmin
      .from("artisan_applications")
      .update(applicationUpdate)
      .eq("id", application.id);

    if (applicationError) {
      return json({ error: applicationError.message }, 500);
    }

    let artisan = null;
    if (status === "verified") {
      artisan = await upsertVerifiedArtisan(supabaseAdmin, application, reference, now);
    } else {
      const artisanUpdate: Record<string, unknown> = {
        identity_verification_status: status,
        identity_verification_reference: reference,
        updated_at: now,
      };

      if (status === "failed") {
        artisanUpdate.verification_status = "pending";
      }

      await supabaseAdmin
        .from("artisans")
        .update(artisanUpdate)
        .eq("application_id", application.id);
    }

    return json({
      ok: true,
      application_code: application.application_code,
      status,
      artisan_id: artisan?.id || null,
      public_listing: artisan?.subscription_status === "active",
      message:
        status === "verified"
          ? "Artisan identity verified. Profile is ready for subscription activation."
          : `Artisan identity verification is ${status}.`,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Webhook handling failed." }, 500);
  }
});

function hasValidWebhookSecret(req: Request, expected: string) {
  const authorization = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-fixam-webhook-secret") || "";
  const urlSecret = new URL(req.url).searchParams.get("secret") || "";

  return authorization === `Bearer ${expected}` || headerSecret === expected || urlSecret === expected;
}

async function findApplicationByReferences(supabaseAdmin: SupabaseAdmin, references: string[]) {
  for (const reference of references) {
    const byReference = await supabaseAdmin
      .from("artisan_applications")
      .select("*")
      .eq("identity_verification_reference", reference)
      .maybeSingle();

    if (!byReference.error && byReference.data) return byReference.data;

    const byAttempt = await supabaseAdmin
      .from("identity_verification_attempts")
      .select("application_code")
      .eq("provider_reference", reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byAttempt.error && byAttempt.data?.application_code) {
      const byCode = await supabaseAdmin
        .from("artisan_applications")
        .select("*")
        .eq("application_code", byAttempt.data.application_code)
        .maybeSingle();

      if (!byCode.error && byCode.data) return byCode.data;
    }
  }

  return null;
}

async function upsertVerifiedArtisan(
  supabaseAdmin: SupabaseAdmin,
  application: Record<string, any>,
  reference: string,
  now: string,
) {
  const coords = coordinatesFor(application.state, application.area);
  const subscriptionPlan = normalizeSubscriptionPlan(application.preferred_plan || application.subscription_plan);
  const subscriptionAmount = Number(application.subscription_amount || subscriptionAmountForPlan(subscriptionPlan));
  const checks = ["QoreID liveness verified", "Virtual NIN verified", "Subscription pending"];

  const payload = {
    application_id: application.id,
    business_name: application.full_name,
    owner_name: application.full_name,
    owner_user_id: application.applicant_user_id || null,
    phone: application.phone,
    category: application.trade,
    state: application.state,
    area: application.area,
    lat: coords.lat,
    lng: coords.lng,
    plan: "Verified",
    profile_status: "active",
    verification_status: "verified",
    identity_verification_status: "verified",
    identity_verification_reference: reference,
    identity_verified_at: now,
    nin_last4: application.nin_last4 || null,
    subscription_status: application.subscription_status || "pending",
    subscription_plan: subscriptionPlan,
    subscription_amount: subscriptionAmount,
    bio: application.work_summary,
    skills: skillsFromTrade(application.trade),
    availability: "Taking scheduled jobs",
    service_radius: 10,
    response_time: "30 min",
    verification_checks: checks,
    portfolio_items: [`${application.trade} work sample`, `${application.area} customer job`],
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("artisans")
    .upsert(payload, { onConflict: "application_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
}

function extractReferenceCandidates(payload: unknown): string[] {
  const candidates: string[] = [];
  const walk = (value: unknown, depth = 0) => {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;

    const source = value as Record<string, unknown>;
    [
      "reference",
      "customerReference",
      "customer_reference",
      "requestId",
      "request_id",
      "flowRequestId",
      "flow_request_id",
      "sessionId",
      "session_id",
      "transactionId",
      "transaction_id",
      "id",
    ].forEach((key) => {
      if (typeof source[key] === "string" || typeof source[key] === "number") {
        candidates.push(String(source[key]));
      }
    });

    Object.values(source).forEach((item) => walk(item, depth + 1));
  };

  walk(payload);
  return candidates;
}

function normalizeQoreIdStatus(payload: unknown) {
  const text = JSON.stringify(payload).toLowerCase();
  const statusValues = extractStatusCandidates(payload).map((value) => value.toLowerCase());

  if (
    statusValues.some((value) => ["verified", "success", "successful", "passed", "approved", "completed", "complete"].includes(value)) ||
    text.includes('"verified":true') ||
    text.includes('"success":true')
  ) {
    return "verified";
  }

  if (
    statusValues.some((value) => ["failed", "failure", "rejected", "declined", "not_found", "unsuccessful"].includes(value)) ||
    text.includes('"verified":false') ||
    text.includes('"success":false')
  ) {
    return "failed";
  }

  return "pending";
}

function extractStatusCandidates(payload: unknown): string[] {
  const candidates: string[] = [];
  const walk = (value: unknown, depth = 0) => {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;

    const source = value as Record<string, unknown>;
    ["status", "state", "result", "decision", "verificationStatus", "verification_status"].forEach((key) => {
      if (typeof source[key] === "string") candidates.push(String(source[key]));
    });

    Object.values(source).forEach((item) => walk(item, depth + 1));
  };

  walk(payload);
  return candidates;
}

function extractProviderMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const source = payload as Record<string, unknown>;
  return String(source.message || source.description || source.reason || "");
}

function summarizeWebhook(payload: unknown) {
  return {
    references: uniqueStrings(extractReferenceCandidates(payload)).slice(0, 8),
    statuses: uniqueStrings(extractStatusCandidates(payload)).slice(0, 8),
    received_at: new Date().toISOString(),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function coordinatesFor(state: string, area: string) {
  const stateCoordinates: Record<string, [number, number]> = {
    Lagos: [6.5244, 3.3792],
    "Abuja/FCT": [9.0765, 7.3986],
    Edo: [6.335, 5.6037],
    Ogun: [7.1608, 3.3486],
    Delta: [5.5325, 5.8987],
    Rivers: [4.8156, 7.0498],
  };
  const [baseLat, baseLng] = stateCoordinates[state] || stateCoordinates.Lagos;
  const hash = String(area || state)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const latOffset = ((hash % 19) - 9) * 0.006;
  const lngOffset = (Math.floor(hash / 19) % 19 - 9) * 0.006;

  return {
    lat: Number((baseLat + latOffset).toFixed(7)),
    lng: Number((baseLng + lngOffset).toFixed(7)),
  };
}

function normalizeSubscriptionPlan(plan: string) {
  const value = String(plan || "").toLowerCase();
  if (value.includes("annual") || value.includes("year")) return "annual";
  if (value.includes("biannual") || value.includes("6")) return "biannual";
  return "monthly";
}

function subscriptionAmountForPlan(plan: string) {
  if (plan === "annual") return 24000;
  if (plan === "biannual") return 12000;
  return 2500;
}

function skillsFromTrade(trade: string) {
  const value = String(trade || "").trim();
  return value ? [value, `${value} repairs`, "Verified local service"] : ["Verified local service"];
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

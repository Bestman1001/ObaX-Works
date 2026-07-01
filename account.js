const settings = window.FIXAM_SUPABASE || {};
const productionAccountUrl = "https://bestman1001.github.io/FixAm-9ja/account.html";
const supabaseClient =
  window.supabase && settings.url && settings.anonKey
    ? window.supabase.createClient(settings.url, settings.anonKey)
    : null;

const authPanel = document.querySelector("#authPanel");
const dashboardPanel = document.querySelector("#dashboardPanel");
const authForm = document.querySelector("#authForm");
const profileForm = document.querySelector("#profileForm");
const artisanProfileForm = document.querySelector("#artisanProfileForm");
const authNote = document.querySelector("#authNote");
const dashboardNote = document.querySelector("#dashboardNote");
const sessionEmail = document.querySelector("#sessionEmail");
const signOutButton = document.querySelector("#signOutButton");
const magicLinkButton = document.querySelector("#magicLinkButton");
const refreshButton = document.querySelector("#refreshButton");
const claimProfileButton = document.querySelector("#claimProfileButton");
const portfolioUploadButton = document.querySelector("#portfolioUploadButton");
const quoteList = document.querySelector("#quoteList");
const quoteLeadList = document.querySelector("#quoteLeadList");
const quoteLeadBadge = document.querySelector("#quoteLeadBadge");
const applicationList = document.querySelector("#applicationList");
const artisanProfile = document.querySelector("#artisanProfile");
const mediaList = document.querySelector("#mediaList");
const quoteDialog = document.querySelector("#quoteDialog");
const quoteDialogType = document.querySelector("#quoteDialogType");
const quoteDialogTitle = document.querySelector("#quoteDialogTitle");
const quoteDialogBody = document.querySelector("#quoteDialogBody");
const quoteDialogClose = document.querySelector("#quoteDialogClose");

let currentUser = null;
let currentProfile = null;
let ownedArtisan = null;
let quoteRecords = new Map();

if (!supabaseClient) {
  setNote(authNote, "Supabase is not configured yet. Accounts cannot be used.", "error");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;

  const mode = document.querySelector("#authMode").value;
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const fullName = document.querySelector("#fullName").value.trim() || email.split("@")[0];
  const phone = document.querySelector("#phone").value.trim();
  const role = document.querySelector("#accountRole").value;

  if (!password) {
    await sendEmailSignInLink();
    return;
  }

  setNote(authNote, mode === "signup" ? "Creating account..." : "Signing in...", "");

  const result =
    mode === "signup"
      ? await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: accountRedirectUrl(),
            data: { full_name: fullName, phone, role },
          },
        })
      : await supabaseClient.auth.signInWithPassword({ email, password });

  if (result.error) {
    setNote(authNote, result.error.message, "error");
    return;
  }

  currentUser = result.data.session?.user || null;
  if (currentUser) {
    if (mode === "signup") {
      await saveUserProfile({ email, fullName, phone, role });
    }
    await loadDashboard();
  } else {
    setNote(authNote, "Check your email to confirm this account, then sign in.", "success");
  }
});

magicLinkButton.addEventListener("click", async () => {
  await sendEmailSignInLink();
});

async function sendEmailSignInLink() {
  if (!supabaseClient) return;

  const email = document.querySelector("#email").value.trim();
  if (!email) {
    setNote(authNote, "Enter your email first.", "error");
    return;
  }

  const fullName = document.querySelector("#fullName").value.trim() || email.split("@")[0];
  const phone = document.querySelector("#phone").value.trim();
  const role = document.querySelector("#accountRole").value;

  setNote(authNote, "Sending your secure sign-in link...", "");
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: accountRedirectUrl(),
      data: { full_name: fullName, phone, role },
    },
  });

  setNote(
    authNote,
    error ? error.message : "Sign-in link sent. Open your email on this device and tap the link.",
    error ? "error" : "success",
  );
}

signOutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  setSignedOut();
});

refreshButton.addEventListener("click", loadDashboard);
quoteDialogClose.addEventListener("click", () => quoteDialog.close());
quoteDialog.addEventListener("click", (event) => {
  if (event.target === quoteDialog) quoteDialog.close();
});

quoteList.addEventListener("click", handleQuoteClick);
quoteLeadList.addEventListener("click", handleQuoteClick);
quoteList.addEventListener("keydown", handleQuoteKeydown);
quoteLeadList.addEventListener("keydown", handleQuoteKeydown);
quoteDialogBody.addEventListener("click", handleQuoteAction);

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  await saveUserProfile({
    email: currentUser.email,
    fullName: document.querySelector("#profileName").value.trim(),
    phone: document.querySelector("#profilePhone").value.trim(),
    role: document.querySelector("#profileRole").value,
  });
  await loadDashboard();
});

artisanProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ownedArtisan) return;

  const payload = {
    business_name: document.querySelector("#artisanBusinessName").value.trim(),
    category: document.querySelector("#artisanCategory").value.trim(),
    area: document.querySelector("#artisanArea").value.trim(),
    availability: document.querySelector("#artisanAvailability").value,
    service_radius: Number(document.querySelector("#artisanServiceRadius").value) || ownedArtisan.service_radius || 10,
    bio: document.querySelector("#artisanBio").value.trim(),
    updated_at: new Date().toISOString(),
  };

  setNote(dashboardNote, "Saving artisan profile...", "");
  const { error } = await supabaseClient.from("artisans").update(payload).eq("id", ownedArtisan.id);
  await loadDashboard({
    message: error ? error.message : "Artisan profile saved.",
    type: error ? "error" : "success",
  });
});

claimProfileButton.addEventListener("click", async () => {
  if (!currentUser || !currentProfile?.phone) return;

  setNote(dashboardNote, "Claiming matching artisan profile...", "");
  if (currentProfile.role !== "artisan") {
    setNote(dashboardNote, "Change your account role to Artisan and save your profile before claiming.", "error");
    return;
  }

  const profilePhoneKey = phoneKey(currentProfile.phone);
  if (!profilePhoneKey) {
    setNote(dashboardNote, "Add your artisan phone number, save your profile, then claim again.", "error");
    return;
  }

  const { data: possibleMatches, error: matchError } = await supabaseClient
    .from("artisans")
    .select("id, business_name, phone, owner_user_id, profile_status")
    .eq("profile_status", "active");

  if (matchError) {
    setNote(dashboardNote, matchError.message, "error");
    return;
  }

  const matchedArtisan = (possibleMatches || []).find((artisan) => phoneKey(artisan.phone) === profilePhoneKey);
  if (!matchedArtisan) {
    setNote(
      dashboardNote,
      "No live artisan profile matches this phone number yet. Check the number in Admin > Artisan profiles.",
      "error",
    );
    return;
  }

  const { data, error } = await supabaseClient
    .from("artisans")
    .update({ owner_user_id: currentUser.id, updated_at: new Date().toISOString() })
    .eq("id", matchedArtisan.id)
    .select();

  if (error) {
    setNote(dashboardNote, error.message, "error");
    return;
  }

  await loadDashboard({
    message: data?.length
      ? `${data[0].business_name} is now connected to your account.`
      : "The profile matched, but Supabase blocked the claim. Run the updated Phase 5 claim policy SQL.",
    type: data?.length ? "success" : "error",
  });
});

portfolioUploadButton.addEventListener("click", async () => {
  if (!ownedArtisan) {
    setNote(dashboardNote, "Claim or create an artisan profile before uploading portfolio media.", "error");
    return;
  }

  const files = selectedFiles("#portfolioMedia");
  if (!files.length) {
    setNote(dashboardNote, "Choose image or video files first.", "error");
    return;
  }

  setNote(dashboardNote, "Uploading portfolio media...", "");
  const result = await uploadMediaFiles({
    files,
    folder: `artisan-profiles/${ownedArtisan.id}`,
    entityType: "artisan_profile",
    entityId: String(ownedArtisan.id),
    role: "artisan",
  });

  setNote(
    dashboardNote,
    result.error ? `Upload needs retry: ${result.error}` : `${result.count} portfolio file${result.count === 1 ? "" : "s"} uploaded.`,
    result.error ? "error" : "success",
  );
  await loadDashboard();
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      loadDashboard();
    } else {
      setSignedOut();
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      currentUser = data.session.user;
      loadDashboard();
    } else {
      setSignedOut();
    }
  });
}

async function loadDashboard(note = null) {
  if (!supabaseClient || !currentUser) return;

  authPanel.hidden = true;
  dashboardPanel.hidden = false;
  signOutButton.hidden = false;
  document.body.classList.add("is-signed-in");
  sessionEmail.textContent = currentUser.email || "Signed in";

  setNote(dashboardNote, "Loading account...", "");
  currentProfile = await loadProfile();
  fillProfileForm();

  const [quotesResult, applicationsResult, artisansResult, mediaResult] = await Promise.all([
    supabaseClient
      .from("quote_requests")
      .select(
        "id, request_code, review_token, artisan_id, artisan_name, artisan_category, artisan_state, artisan_area, job_location, urgency, job_details, status, media_count, created_at",
      )
      .eq("customer_user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20),
      supabaseClient
        .from("artisan_applications")
        .select(
          "application_code, applicant_email, trade, state, area, status, media_count, verification_media_count, identity_verification_status, subscription_status, subscription_amount, created_at",
        )
      .eq("applicant_user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseClient
      .from("artisans")
      .select(
        "id, business_name, category, state, area, phone, plan, profile_status, verification_status, identity_verification_status, subscription_status, subscription_plan, subscription_amount, bio, availability, service_radius, updated_at",
      )
      .eq("owner_user_id", currentUser.id)
      .limit(5),
    supabaseClient
      .from("media_uploads")
      .select("file_name, public_url, entity_type, created_at")
      .eq("uploaded_by_user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  ownedArtisan = artisansResult.data?.[0] || null;
  const quoteLeadsResult = ownedArtisan
    ? await supabaseClient
        .from("quote_requests")
        .select(
          "id, request_code, customer_name, customer_phone, artisan_name, artisan_category, job_location, urgency, job_details, status, media_count, created_at",
          { count: "exact" },
        )
        .eq("artisan_id", ownedArtisan.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], count: 0, error: null };

  quoteRecords = new Map();
  renderQuotes(quotesResult.data || []);
  renderQuoteLeads(quoteLeadsResult.data || [], quoteLeadsResult.count || 0);
  renderApplications(applicationsResult.data || []);
  renderArtisanProfile(artisansResult.data || []);
  fillArtisanProfileForm();
  renderMedia(mediaResult.data || []);

  const firstError =
    quotesResult.error || applicationsResult.error || artisansResult.error || mediaResult.error || quoteLeadsResult.error;
  if (firstError) {
    setNote(dashboardNote, `${firstError.message}. Make sure the Phase 5 SQL has been run.`, "error");
    return;
  }

  setNote(dashboardNote, note?.message || "Account loaded.", note?.type || "success");
}

async function loadProfile() {
  const { data } = await supabaseClient.from("user_profiles").select("*").eq("user_id", currentUser.id).maybeSingle();
  if (data) return data;

  const fallback = {
    email: currentUser.email,
    full_name: currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "FixAm user",
    phone: currentUser.user_metadata?.phone || "",
    role: currentUser.user_metadata?.role || "customer",
  };
  await saveUserProfile({
    email: fallback.email,
    fullName: fallback.full_name,
    phone: fallback.phone,
    role: fallback.role,
  });
  return { user_id: currentUser.id, ...fallback };
}

async function saveUserProfile({ email, fullName, phone, role }) {
  const payload = {
    user_id: currentUser.id,
    email,
    full_name: fullName || email,
    phone,
    role,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseClient.from("user_profiles").upsert(payload);
  setNote(dashboardNote, error ? error.message : "Profile saved.", error ? "error" : "success");
}

function fillProfileForm() {
  document.querySelector("#profileName").value = currentProfile?.full_name || "";
  document.querySelector("#profilePhone").value = currentProfile?.phone || "";
  document.querySelector("#profileRole").value = currentProfile?.role || "customer";
  document.querySelector("#dashboardTitle").textContent = `Welcome, ${currentProfile?.full_name || "FixAm user"}`;
}

function renderQuotes(items) {
  items.forEach((item) => quoteRecords.set(`customer:${item.id}`, { ...item, viewType: "customer" }));
  quoteList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="quote-item" role="button" tabindex="0" data-quote-key="customer:${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.request_code)} - ${escapeHtml(item.artisan_name)}</strong>
              <small>${escapeHtml(item.artisan_category)} at ${escapeHtml(item.job_location)}</small>
              <small>${escapeHtml(item.status)} - ${item.media_count || 0} media - open details</small>
            </article>
          `,
        )
        .join("")
    : `<article><span>No quote requests linked to this account yet.</span></article>`;
}

function renderQuoteLeads(items, total) {
  quoteLeadBadge.textContent = String(total);
  quoteLeadBadge.classList.toggle("is-empty", total === 0);
  items.forEach((item) => quoteRecords.set(`lead:${item.id}`, { ...item, viewType: "lead" }));

  quoteLeadList.innerHTML = ownedArtisan
    ? items.length
      ? items
          .map(
            (item) => `
              <article class="quote-item" role="button" tabindex="0" data-quote-key="lead:${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.request_code)} - ${escapeHtml(item.customer_name)}</strong>
                <small>${escapeHtml(item.job_location)} - ${escapeHtml(item.urgency)} - ${escapeHtml(item.status)}</small>
                <small>${escapeHtml(item.customer_phone)} - ${item.media_count || 0} media - open details</small>
              </article>
            `,
          )
          .join("")
      : `<article><span>No customer quote leads have arrived for your artisan profile yet.</span></article>`
    : `<article><span>Claim an artisan profile to see customer quote leads here.</span></article>`;
}

function handleQuoteClick(event) {
  const item = event.target.closest(".quote-item");
  if (!item) return;
  openQuoteDetails(item.dataset.quoteKey);
}

function handleQuoteKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest(".quote-item");
  if (!item) return;
  event.preventDefault();
  openQuoteDetails(item.dataset.quoteKey);
}

async function openQuoteDetails(quoteKey) {
  const quote = quoteRecords.get(quoteKey);
  if (!quote) return;

  quoteDialogType.textContent = quote.viewType === "lead" ? "Quote lead" : "Your quote request";
  quoteDialogTitle.textContent = `${quote.request_code} - ${
    quote.viewType === "lead" ? quote.customer_name : quote.artisan_name
  }`;
  quoteDialogBody.innerHTML = renderQuoteDetails(quote, []);
  if (!quoteDialog.open) quoteDialog.showModal();

  const { data, error } = await supabaseClient
    .from("media_uploads")
    .select("file_name, public_url, mime_type, created_at")
    .eq("entity_type", "quote_request")
    .in("entity_id", [String(quote.id), quote.request_code])
    .order("created_at", { ascending: false });

  quoteDialogBody.innerHTML = renderQuoteDetails(quote, error ? [] : data || [], error?.message || "");
}

function renderQuoteDetails(quote, mediaItems, mediaError = "") {
  const detailName = quote.viewType === "lead" ? quote.customer_name : quote.artisan_name;
  const phoneBlock =
    quote.viewType === "lead"
      ? `<article><span>Customer phone</span>${escapeHtml(quote.customer_phone)}</article>`
      : `<article><span>Trade</span>${escapeHtml(quote.artisan_category)}</article>`;
  const actionBlock = quote.viewType === "lead" ? renderQuoteActions(quote) : "";
  const customerActionBlock = quote.viewType === "customer" ? renderCustomerQuoteActions(quote) : "";

  return `
    ${actionBlock}
    ${customerActionBlock}
    <div class="quote-detail-grid">
      <article><span>Name</span>${escapeHtml(detailName)}</article>
      <article><span>Location</span>${escapeHtml(quote.job_location)}</article>
      <article><span>Urgency</span>${escapeHtml(quote.urgency || "Not specified")}</article>
      <article><span>Status</span>${escapeHtml(quote.status)}</article>
      ${phoneBlock}
      <article><span>Media count</span>${quote.media_count || 0}</article>
    </div>
    <div class="quote-details-text">
      <span>Job details</span>
      <p>${escapeHtml(quote.job_details || "No job details supplied.")}</p>
    </div>
    <div>
      <h3>Attached photos/videos</h3>
      ${
        mediaError
          ? `<p class="form-note error-note">${escapeHtml(mediaError)}</p>`
          : renderQuoteMedia(mediaItems)
      }
    </div>
  `;
}

function renderCustomerQuoteActions(quote) {
  const canCancel = ["new", "contacted"].includes(quote.status);
  const canComplete = ["contacted", "accepted"].includes(quote.status);
  const reviewUrl = quote.status === "completed" ? reviewLinkForQuote(quote) : "";
  const statusText =
    quote.status === "completed"
      ? "This job is marked complete. You can now review the artisan and attach proof of work."
      : quote.status === "cancelled"
        ? "You cancelled this request. It remains here for your records."
        : quote.status === "declined"
          ? "The artisan declined this request. You can choose another artisan from the marketplace."
          : quote.status === "accepted"
            ? "The artisan accepted your job. Mark it completed after the work is done."
            : quote.status === "contacted"
              ? "The artisan has contacted you. You can cancel or mark complete after the work is done."
              : "Your request is waiting for the artisan to respond.";

  return `
    <section class="quote-actions customer-quote-actions" data-quote-id="${escapeHtml(quote.id)}">
      <div>
        <span>Customer action</span>
        <strong>${escapeHtml(statusText)}</strong>
      </div>
      <div class="quote-action-buttons">
        ${
          canComplete
            ? `<button class="primary-action" type="button" data-quote-action="completed">Mark completed</button>`
            : ""
        }
        ${
          reviewUrl
            ? `<a class="primary-action quote-review-link" href="${escapeHtml(reviewUrl)}">Leave review</a>`
            : ""
        }
        ${
          canCancel
            ? `<button class="danger-action" type="button" data-quote-action="cancelled">Cancel request</button>`
            : ""
        }
      </div>
    </section>
  `;
}

function renderQuoteActions(quote) {
  const disabled = ["accepted", "declined", "completed", "cancelled"].includes(quote.status);
  const statusText =
    quote.status === "accepted"
      ? "You accepted this job. Contact the customer to agree price, timing, and next steps."
      : quote.status === "declined"
        ? "You declined this quote. It will stay in your history for reference."
        : quote.status === "contacted"
          ? "You marked this customer as contacted. Accept the job when you are ready to proceed."
          : "Choose what you want to do with this customer request.";

  return `
    <section class="quote-actions" data-quote-id="${escapeHtml(quote.id)}">
      <div>
        <span>Artisan response</span>
        <strong>${escapeHtml(statusText)}</strong>
      </div>
      <div class="quote-action-buttons">
        <button class="primary-action" type="button" data-quote-action="accepted" ${disabled ? "disabled" : ""}>
          Accept job
        </button>
        <button class="secondary-action" type="button" data-quote-action="contacted" ${
          disabled || quote.status === "contacted" ? "disabled" : ""
        }>
          Mark contacted
        </button>
        <button class="danger-action" type="button" data-quote-action="declined" ${disabled ? "disabled" : ""}>
          Decline
        </button>
      </div>
    </section>
  `;
}

async function handleQuoteAction(event) {
  const button = event.target.closest("[data-quote-action]");
  if (!button) return;

  const actionPanel = button.closest("[data-quote-id]");
  const quote = [...quoteRecords.values()].find((item) => item.id === actionPanel?.dataset.quoteId);
  if (!quote) return;

  const nextStatus = button.dataset.quoteAction;
  const originalText = button.textContent;
  button.textContent = "Saving...";
  button.disabled = true;

  const rpcName = quote.viewType === "lead" ? "update_quote_request_status" : "update_customer_quote_status";
  const { data, error } = await supabaseClient.rpc(rpcName, {
    p_quote_id: quote.id,
    p_status: nextStatus,
  });

  if (error) {
    button.textContent = originalText;
    button.disabled = false;
    setNote(dashboardNote, `Could not update quote: ${error.message}`, "error");
    quoteDialogBody.insertAdjacentHTML(
      "afterbegin",
      `<p class="form-note error-note">${escapeHtml(error.message)}</p>`,
    );
    return;
  }

  const updatedQuote = Array.isArray(data) ? data[0] : data;
  if (updatedQuote) Object.assign(quote, updatedQuote);
  quote.status = updatedQuote?.status || nextStatus;
  const quoteKey = `${quote.viewType}:${quote.id}`;
  quoteRecords.set(quoteKey, quote);
  setNote(dashboardNote, `${quote.request_code} updated to ${nextStatus}.`, "success");
  await openQuoteDetails(quoteKey);
  await loadDashboard();
}

function reviewLinkForQuote(quote) {
  if (!quote.review_token || !quote.artisan_id) return "";

  const url = new URL("review.html", window.location.href);
  url.searchParams.set("token", quote.review_token);
  url.searchParams.set("quote_id", quote.id);
  url.searchParams.set("artisan_id", quote.artisan_id);
  url.searchParams.set("artisan_name", quote.artisan_name || "this artisan");
  url.searchParams.set("artisan_category", quote.artisan_category || "Artisan");
  url.searchParams.set("artisan_state", quote.artisan_state || "");
  url.searchParams.set("artisan_area", quote.artisan_area || "");
  return url.toString();
}

function renderQuoteMedia(items) {
  if (!items.length) {
    return `<p class="form-note">No photos or videos attached to this quote.</p>`;
  }

  return `
    <div class="quote-media-grid">
      ${items
        .map((item) => {
          const media =
            item.mime_type?.startsWith("image/")
              ? `<a href="${escapeHtml(item.public_url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(
                  item.public_url,
                )}" alt="${escapeHtml(item.file_name)}" /></a>`
              : item.mime_type?.startsWith("video/")
                ? `<video src="${escapeHtml(item.public_url)}" controls></video>`
                : `<a href="${escapeHtml(item.public_url)}" target="_blank" rel="noreferrer">Open file</a>`;

          return `
            <article class="quote-media-item">
              ${media}
              <a href="${escapeHtml(item.public_url)}" target="_blank" rel="noreferrer">${escapeHtml(item.file_name)}</a>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderApplications(items) {
  applicationList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article>
              <strong>${escapeHtml(item.application_code)} - ${escapeHtml(item.trade)}</strong>
              <small>${escapeHtml(item.applicant_email || currentUser.email || "No login email")}</small>
              <small>${escapeHtml(item.area)}, ${escapeHtml(item.state)}</small>
              <small>${escapeHtml(item.status)} - ${item.media_count || 0} portfolio media - ${item.verification_media_count || 0} identity proof</small>
              <small>NIN ${escapeHtml(item.identity_verification_status || "pending")} - Subscription ${escapeHtml(
                item.subscription_status || "pending",
              )} - ${formatNaira(item.subscription_amount)}</small>
            </article>
          `,
        )
        .join("")
    : `<article><span>No artisan applications linked to this account yet.</span></article>`;
}

function renderArtisanProfile(items) {
  artisanProfile.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="connected-profile">
              <strong>${escapeHtml(item.business_name)}</strong>
              <small>${escapeHtml(item.category)} in ${escapeHtml(item.area)}, ${escapeHtml(item.state)}</small>
              <small>${escapeHtml(item.profile_status)} - ${escapeHtml(item.plan)} - ${escapeHtml(item.verification_status)}</small>
              <small>NIN ${escapeHtml(item.identity_verification_status || "pending")} - Subscription ${escapeHtml(
                item.subscription_status || "pending",
              )} - ${formatNaira(item.subscription_amount)}</small>
              <small>${escapeHtml(item.availability || "Taking scheduled jobs")} - ${item.service_radius || 10} mile radius</small>
            </article>
          `,
        )
        .join("")
    : `<article><span>No claimed artisan profile yet. Use the claim button if your phone number matches a listed profile.</span></article>`;

  claimProfileButton.hidden = items.length > 0;
  artisanProfileForm.hidden = !items.length;
}

function fillArtisanProfileForm() {
  if (!ownedArtisan) {
    artisanProfileForm.reset();
    return;
  }

  document.querySelector("#artisanBusinessName").value = ownedArtisan.business_name || "";
  document.querySelector("#artisanCategory").value = ownedArtisan.category || "";
  document.querySelector("#artisanArea").value = ownedArtisan.area || "";
  document.querySelector("#artisanAvailability").value = ownedArtisan.availability || "Taking scheduled jobs";
  document.querySelector("#artisanServiceRadius").value = ownedArtisan.service_radius || 10;
  document.querySelector("#artisanBio").value = ownedArtisan.bio || "";
}

function renderMedia(items) {
  mediaList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article>
              <a href="${escapeHtml(item.public_url)}" target="_blank" rel="noreferrer">${escapeHtml(item.file_name)}</a>
              <small>${escapeHtml(item.entity_type)}</small>
            </article>
          `,
        )
        .join("")
    : `<article><span>No media uploaded from this account yet.</span></article>`;
}

function setSignedOut() {
  authPanel.hidden = false;
  dashboardPanel.hidden = true;
  signOutButton.hidden = true;
  document.body.classList.remove("is-signed-in");
  sessionEmail.textContent = "Signed out";
  currentUser = null;
  currentProfile = null;
  ownedArtisan = null;
}

function setNote(element, message, type) {
  element.textContent = message;
  element.classList.remove("success-note", "error-note");
  if (type === "success") element.classList.add("success-note");
  if (type === "error") element.classList.add("error-note");
}

function selectedFiles(selector) {
  const input = document.querySelector(selector);
  return input ? [...input.files].slice(0, 6) : [];
}

async function uploadMediaFiles({ files, folder, entityType, entityId, role }) {
  if (!supabaseClient || !files.length) return { count: 0 };

  let count = 0;
  for (const file of files) {
    if (!isAllowedMedia(file)) {
      return { count, error: `${file.name} is too large or not a supported image/video type.` };
    }

    const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabaseClient.storage.from("fixam-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) return { count, error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabaseClient.storage.from("fixam-media").getPublicUrl(path);

    const { error: metadataError } = await supabaseClient.from("media_uploads").insert({
      bucket: "fixam-media",
      storage_path: path,
      public_url: publicUrl,
      entity_type: entityType,
      entity_id: entityId,
      uploaded_by_role: role,
      uploaded_by_user_id: currentUser.id,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
      visibility: "public",
    });

    if (metadataError) return { count, error: metadataError.message };
    count += 1;
  }

  return { count };
}

function isAllowedMedia(file) {
  const validType = file.type.startsWith("image/") || file.type.startsWith("video/");
  return validType && file.size <= 50 * 1024 * 1024;
}

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function phoneKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234") && digits.length >= 13) return digits.slice(-10);
  if (digits.startsWith("0") && digits.length >= 11) return digits.slice(-10);
  return digits.slice(-10);
}

function accountRedirectUrl() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return productionAccountUrl;
  }

  const redirectUrl = new URL("account.html", window.location.href);
  redirectUrl.hash = "";
  redirectUrl.search = "";
  return redirectUrl.href;
}

function formatNaira(value) {
  return `NGN ${Number(value || 0).toLocaleString("en-NG")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

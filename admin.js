const settings = window.FIXAM_SUPABASE || {};
const supabaseClient =
  window.supabase && settings.url && settings.anonKey
    ? window.supabase.createClient(settings.url, settings.anonKey)
    : null;

const quoteStatuses = ["new", "contacted", "accepted", "declined", "completed", "cancelled"];
const applicationStatuses = ["new", "reviewing", "approved", "rejected", "listed"];
const reviewVisibilityStatuses = ["public", "flagged", "hidden"];
const artisanStandingStatuses = ["active", "warning", "suspended", "removed"];
const states = ["Lagos", "Abuja/FCT", "Edo", "Ogun", "Delta", "Rivers"];

const authPanel = document.querySelector("#authPanel");
const dashboardPanel = document.querySelector("#dashboardPanel");
const authForm = document.querySelector("#authForm");
const authNote = document.querySelector("#authNote");
const dashboardNote = document.querySelector("#dashboardNote");
const sessionEmail = document.querySelector("#sessionEmail");
const signOutButton = document.querySelector("#signOutButton");
const refreshButton = document.querySelector("#refreshButton");
const magicLinkButton = document.querySelector("#magicLinkButton");
const quoteList = document.querySelector("#quoteList");
const applicationList = document.querySelector("#applicationList");
const reviewList = document.querySelector("#reviewList");
const qualityList = document.querySelector("#qualityList");
const metricsGrid = document.querySelector("#metricsGrid");
const stateFilter = document.querySelector("#stateFilter");
const statusFilter = document.querySelector("#statusFilter");

let quotes = [];
let applications = [];
let reviews = [];
let qualityControls = [];
let activeView = "quotes";

states.forEach((state) => stateFilter.add(new Option(state, state)));

if (!supabaseClient) {
  setNote(authNote, "Supabase is not configured yet. Add the project URL and anon key first.", "error");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;

  setNote(authNote, "Signing in...", "");
  const email = document.querySelector("#adminEmail").value.trim();
  const password = document.querySelector("#adminPassword").value;

  if (!password) {
    setNote(authNote, "Enter a password or use the magic link button.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setNote(authNote, error.message, "error");
    return;
  }

  setNote(authNote, "Signed in.", "success");
  await loadDashboard();
});

magicLinkButton.addEventListener("click", async () => {
  if (!supabaseClient) return;

  const email = document.querySelector("#adminEmail").value.trim();
  if (!email) {
    setNote(authNote, "Enter your admin email first.", "error");
    return;
  }

  setNote(authNote, "Sending magic link...", "");
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  if (error) {
    setNote(authNote, error.message, "error");
    return;
  }

  setNote(authNote, "Magic link sent. Open it on this device to continue.", "success");
});

signOutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  setSignedOut();
});

refreshButton.addEventListener("click", loadDashboard);
stateFilter.addEventListener("change", renderDashboard);
statusFilter.addEventListener("change", renderDashboard);

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
    quoteList.hidden = activeView !== "quotes";
    applicationList.hidden = activeView !== "applications";
    reviewList.hidden = activeView !== "reviews";
    qualityList.hidden = activeView !== "quality";
    renderDashboard();
  });
});

quoteList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-review-link]");
  if (!button) return;

  await createReviewLink(button.dataset.reviewLink);
});

quoteList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-quote-status]");
  if (!select) return;
  await updateStatus("quote_requests", select.dataset.quoteStatus, select.value);
});

applicationList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-application-status]");
  if (!select) return;
  await updateStatus("artisan_applications", select.dataset.applicationStatus, select.value);
});

reviewList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-review-visibility]");
  if (!select) return;
  await updateStatus("artisan_reviews", select.dataset.reviewVisibility, select.value, "visibility");
});

qualityList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-artisan-standing]");
  if (!select) return;
  await updateArtisanStanding(Number(select.dataset.artisanStanding), select.value);
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) loadDashboard();
    else setSignedOut();
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) loadDashboard();
    else setSignedOut();
  });
}

async function loadDashboard() {
  if (!supabaseClient) return;

  setNote(dashboardNote, "Loading dashboard...", "");
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    setSignedOut();
    return;
  }

  authPanel.hidden = true;
  dashboardPanel.hidden = false;
  sessionEmail.textContent = session.user.email || "Signed in";
  signOutButton.hidden = false;

  const [quoteResult, applicationResult, reviewResult, qualityResult] = await Promise.all([
    supabaseClient
      .from("quote_requests")
      .select(
        "id, request_code, review_token, artisan_id, artisan_name, artisan_category, artisan_state, artisan_area, customer_name, customer_phone, job_location, urgency, job_details, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseClient
      .from("artisan_applications")
      .select(
        "id, application_code, full_name, trade, state, area, phone, preferred_plan, years_experience, work_summary, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseClient
      .from("artisan_reviews")
      .select(
        "id, review_token, artisan_id, artisan_name, artisan_category, artisan_state, artisan_area, customer_name, rating, quality_rating, timeliness_rating, professionalism_rating, price_fairness_rating, would_recommend, comment, visibility, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseClient
      .from("artisan_quality_controls")
      .select("artisan_id, artisan_name, artisan_category, artisan_state, artisan_area, standing, admin_note, updated_at"),
  ]);

  if (quoteResult.error || applicationResult.error || reviewResult.error || qualityResult.error) {
    const message =
      quoteResult.error?.message || applicationResult.error?.message || reviewResult.error?.message || qualityResult.error?.message;
    setNote(
      dashboardNote,
      `${message}. Confirm that the latest Supabase schema was run and your user exists in admin_profiles.`,
      "error",
    );
    quotes = [];
    applications = [];
    reviews = [];
    qualityControls = [];
    renderDashboard();
    return;
  }

  quotes = quoteResult.data || [];
  applications = applicationResult.data || [];
  reviews = reviewResult.data || [];
  qualityControls = qualityResult.data || [];
  setNote(
    dashboardNote,
    `Loaded ${quotes.length} quotes, ${applications.length} applications, and ${reviews.length} reviews.`,
    "success",
  );
  renderDashboard();
}

function renderDashboard() {
  const filteredQuotes = filterRows(quotes, "artisan_state");
  const filteredApplications = filterRows(applications, "state");
  const filteredReviews = filterRows(reviews, "artisan_state", "visibility");
  const filteredQuality = filterRows(buildQualityRows(), "artisan_state", "standing");

  quoteList.innerHTML = filteredQuotes.length
    ? filteredQuotes.map(renderQuoteCard).join("")
    : `<article class="empty-state">No quote requests match the current filters.</article>`;

  applicationList.innerHTML = filteredApplications.length
    ? filteredApplications.map(renderApplicationCard).join("")
    : `<article class="empty-state">No artisan applications match the current filters.</article>`;

  reviewList.innerHTML = filteredReviews.length
    ? filteredReviews.map(renderReviewCard).join("")
    : `<article class="empty-state">No customer reviews match the current filters.</article>`;

  qualityList.innerHTML = filteredQuality.length
    ? filteredQuality.map(renderQualityCard).join("")
    : `<article class="empty-state">No artisan quality records match the current filters.</article>`;

  renderMetrics();
}

function filterRows(rows, stateKey, statusKey = "status") {
  return rows
    .filter((row) => stateFilter.value === "all" || row[stateKey] === stateFilter.value)
    .filter((row) => statusFilter.value === "all" || row[statusKey] === statusFilter.value);
}

function renderMetrics() {
  const newQuotes = quotes.filter((quote) => quote.status === "new").length;
  const newApplications = applications.filter((application) => application.status === "new").length;
  const inProgress =
    quotes.filter((quote) => ["contacted", "accepted"].includes(quote.status)).length +
    applications.filter((application) => ["reviewing", "approved"].includes(application.status)).length;
  const completed =
    quotes.filter((quote) => quote.status === "completed").length +
    applications.filter((application) => application.status === "listed").length;

  metricsGrid.innerHTML = [
    [newQuotes, "New quotes"],
    [newApplications, "New applications"],
    [inProgress, "In progress"],
    [completed, "Completed/listed"],
  ]
    .map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderQuoteCard(quote) {
  return `
    <article class="work-card">
      <div>
        <div class="badge-row">
          <span class="badge gold">${quote.status}</span>
          <span class="badge">${quote.request_code}</span>
          <span class="badge">${formatDate(quote.created_at)}</span>
        </div>
        <h3>${escapeHtml(quote.customer_name)} needs ${escapeHtml(quote.artisan_category)}</h3>
        <p>${escapeHtml(quote.job_details)}</p>
        <div class="work-meta">
          <span class="badge">${escapeHtml(quote.customer_phone)}</span>
          <span class="badge">${escapeHtml(quote.job_location)}</span>
          <span class="badge">${escapeHtml(quote.urgency)}</span>
          <span class="badge">${escapeHtml(quote.artisan_area)}, ${escapeHtml(quote.artisan_state)}</span>
        </div>
        <p><strong>Requested artisan:</strong> ${escapeHtml(quote.artisan_name)}</p>
      </div>
      <div class="work-actions">
        <label>
          <span>Status</span>
          <select data-quote-status="${quote.id}">
            ${quoteStatuses.map((status) => option(status, quote.status)).join("")}
          </select>
        </label>
        <button class="secondary-action" type="button" data-review-link="${quote.id}">Copy review link</button>
        ${quote.review_token ? `<p class="mini-note">Review link ready</p>` : `<p class="mini-note">Creates one-time customer link</p>`}
      </div>
    </article>
  `;
}

function renderApplicationCard(application) {
  return `
    <article class="work-card">
      <div>
        <div class="badge-row">
          <span class="badge gold">${application.status}</span>
          <span class="badge">${application.application_code}</span>
          <span class="badge">${formatDate(application.created_at)}</span>
        </div>
        <h3>${escapeHtml(application.full_name)} - ${escapeHtml(application.trade)}</h3>
        <p>${escapeHtml(application.work_summary)}</p>
        <div class="work-meta">
          <span class="badge">${escapeHtml(application.phone)}</span>
          <span class="badge">${escapeHtml(application.area)}, ${escapeHtml(application.state)}</span>
          <span class="badge">${escapeHtml(application.preferred_plan)}</span>
          <span class="badge">${application.years_experience} yrs</span>
        </div>
      </div>
      <div class="work-actions">
        <label>
          <span>Status</span>
          <select data-application-status="${application.id}">
            ${applicationStatuses.map((status) => option(status, application.status)).join("")}
          </select>
        </label>
      </div>
    </article>
  `;
}

function renderReviewCard(review) {
  return `
    <article class="work-card">
      <div>
        <div class="badge-row">
          <span class="badge gold">${review.visibility}</span>
          <span class="badge">★ ${review.rating}</span>
          <span class="badge">${formatDate(review.created_at)}</span>
        </div>
        <h3>${escapeHtml(review.customer_name)} reviewed ${escapeHtml(review.artisan_name)}</h3>
        <p>${escapeHtml(review.comment)}</p>
        <div class="work-meta">
          <span class="badge">Quality ${review.quality_rating}</span>
          <span class="badge">Time ${review.timeliness_rating}</span>
          <span class="badge">Professional ${review.professionalism_rating}</span>
          <span class="badge">Price ${review.price_fairness_rating}</span>
          <span class="badge">${review.would_recommend ? "Recommends" : "Would not recommend"}</span>
        </div>
      </div>
      <div class="work-actions">
        <label>
          <span>Visibility</span>
          <select data-review-visibility="${review.id}">
            ${reviewVisibilityStatuses.map((status) => option(status, review.visibility)).join("")}
          </select>
        </label>
      </div>
    </article>
  `;
}

function renderQualityCard(artisan) {
  const stats = reviewStatsFor(artisan.artisan_id);
  return `
    <article class="work-card">
      <div>
        <div class="badge-row">
          <span class="badge gold">${artisan.standing}</span>
          <span class="badge">${stats.count} reviews</span>
          <span class="badge">★ ${stats.average}</span>
        </div>
        <h3>${escapeHtml(artisan.artisan_name)}</h3>
        <p>${escapeHtml(artisan.artisan_category)} in ${escapeHtml(artisan.artisan_area)}, ${escapeHtml(artisan.artisan_state)}</p>
        <div class="work-meta">
          <span class="badge">${stats.low} low reviews</span>
          <span class="badge">${stats.recommendRate}% recommend</span>
        </div>
      </div>
      <div class="work-actions">
        <label>
          <span>Standing</span>
          <select data-artisan-standing="${artisan.artisan_id}">
            ${artisanStandingStatuses.map((status) => option(status, artisan.standing)).join("")}
          </select>
        </label>
      </div>
    </article>
  `;
}

function buildQualityRows() {
  const byId = new Map();

  [...quotes, ...reviews].forEach((item) => {
    if (!item.artisan_id) return;
    byId.set(item.artisan_id, {
      artisan_id: item.artisan_id,
      artisan_name: item.artisan_name,
      artisan_category: item.artisan_category,
      artisan_state: item.artisan_state,
      artisan_area: item.artisan_area,
      standing: "active",
    });
  });

  qualityControls.forEach((item) => {
    byId.set(item.artisan_id, { ...byId.get(item.artisan_id), ...item });
  });

  return [...byId.values()];
}

function reviewStatsFor(artisanId) {
  const items = reviews.filter((review) => review.artisan_id === artisanId && review.visibility === "public");
  const count = items.length;
  const total = items.reduce((sum, review) => sum + review.rating, 0);
  const recommend = items.filter((review) => review.would_recommend).length;
  const low = items.filter((review) => review.rating <= 2).length;

  return {
    count,
    low,
    average: count ? (total / count).toFixed(1) : "0.0",
    recommendRate: count ? Math.round((recommend / count) * 100) : 0,
  };
}

async function updateStatus(table, id, status, field = "status") {
  setNote(dashboardNote, "Updating status...", "");
  const { error } = await supabaseClient.from(table).update({ [field]: status }).eq("id", id);

  if (error) {
    setNote(dashboardNote, error.message, "error");
    return;
  }

  const collection = table === "quote_requests" ? quotes : table === "artisan_reviews" ? reviews : applications;
  const row = collection.find((item) => item.id === id);
  if (row) row[field] = status;

  setNote(dashboardNote, "Status updated.", "success");
  renderDashboard();
}

async function updateArtisanStanding(artisanId, standing) {
  const row = buildQualityRows().find((item) => item.artisan_id === artisanId);
  if (!row) return;

  setNote(dashboardNote, "Updating artisan standing...", "");
  const payload = {
    artisan_id: artisanId,
    artisan_name: row.artisan_name,
    artisan_category: row.artisan_category,
    artisan_state: row.artisan_state,
    artisan_area: row.artisan_area,
    standing,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("artisan_quality_controls").upsert(payload);

  if (error) {
    setNote(dashboardNote, error.message, "error");
    return;
  }

  const existing = qualityControls.find((item) => item.artisan_id === artisanId);
  if (existing) Object.assign(existing, payload);
  else qualityControls.push(payload);

  setNote(dashboardNote, "Artisan standing updated.", "success");
  renderDashboard();
}

async function createReviewLink(quoteId) {
  const quote = quotes.find((item) => item.id === quoteId);
  if (!quote) return;

  let token = quote.review_token;
  if (!token) {
    token = `rv-${quote.request_code.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabaseClient.from("quote_requests").update({ review_token: token }).eq("id", quote.id);

    if (error) {
      setNote(dashboardNote, error.message, "error");
      return;
    }

    quote.review_token = token;
  }

  const url = new URL("review.html", window.location.href);
  url.searchParams.set("token", token);
  url.searchParams.set("quote_id", quote.id);
  url.searchParams.set("artisan_id", quote.artisan_id);
  url.searchParams.set("artisan_name", quote.artisan_name);
  url.searchParams.set("artisan_category", quote.artisan_category);
  url.searchParams.set("artisan_state", quote.artisan_state);
  url.searchParams.set("artisan_area", quote.artisan_area);

  try {
    await navigator.clipboard.writeText(url.toString());
    setNote(dashboardNote, "Review link copied. Send it to the customer after the job is complete.", "success");
  } catch (_error) {
    setNote(dashboardNote, `Review link ready: ${url.toString()}`, "success");
  }
  renderDashboard();
}

function setSignedOut() {
  authPanel.hidden = false;
  dashboardPanel.hidden = true;
  sessionEmail.textContent = "Signed out";
  signOutButton.hidden = true;
}

function setNote(element, message, type) {
  element.textContent = message;
  element.classList.remove("success-note", "error-note");
  if (type === "success") element.classList.add("success-note");
  if (type === "error") element.classList.add("error-note");
}

function option(value, selected) {
  return `<option value="${value}"${value === selected ? " selected" : ""}>${titleCase(value)}</option>`;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

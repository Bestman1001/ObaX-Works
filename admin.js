const settings = window.FIXAM_SUPABASE || {};
const supabaseClient =
  window.supabase && settings.url && settings.anonKey
    ? window.supabase.createClient(settings.url, settings.anonKey)
    : null;

const quoteStatuses = ["new", "contacted", "accepted", "declined", "completed", "cancelled"];
const applicationStatuses = ["new", "reviewing", "approved", "rejected", "listed"];
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
const metricsGrid = document.querySelector("#metricsGrid");
const stateFilter = document.querySelector("#stateFilter");
const statusFilter = document.querySelector("#statusFilter");

let quotes = [];
let applications = [];
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
    renderDashboard();
  });
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

  const [quoteResult, applicationResult] = await Promise.all([
    supabaseClient
      .from("quote_requests")
      .select(
        "id, request_code, artisan_name, artisan_category, artisan_state, artisan_area, customer_name, customer_phone, job_location, urgency, job_details, status, created_at",
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
  ]);

  if (quoteResult.error || applicationResult.error) {
    const message = quoteResult.error?.message || applicationResult.error?.message;
    setNote(
      dashboardNote,
      `${message}. Confirm that the latest Supabase schema was run and your user exists in admin_profiles.`,
      "error",
    );
    quotes = [];
    applications = [];
    renderDashboard();
    return;
  }

  quotes = quoteResult.data || [];
  applications = applicationResult.data || [];
  setNote(dashboardNote, `Loaded ${quotes.length} quote requests and ${applications.length} artisan applications.`, "success");
  renderDashboard();
}

function renderDashboard() {
  const filteredQuotes = filterRows(quotes, "artisan_state");
  const filteredApplications = filterRows(applications, "state");

  quoteList.innerHTML = filteredQuotes.length
    ? filteredQuotes.map(renderQuoteCard).join("")
    : `<article class="empty-state">No quote requests match the current filters.</article>`;

  applicationList.innerHTML = filteredApplications.length
    ? filteredApplications.map(renderApplicationCard).join("")
    : `<article class="empty-state">No artisan applications match the current filters.</article>`;

  renderMetrics();
}

function filterRows(rows, stateKey) {
  return rows
    .filter((row) => stateFilter.value === "all" || row[stateKey] === stateFilter.value)
    .filter((row) => statusFilter.value === "all" || row.status === statusFilter.value);
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

async function updateStatus(table, id, status) {
  setNote(dashboardNote, "Updating status...", "");
  const { error } = await supabaseClient.from(table).update({ status }).eq("id", id);

  if (error) {
    setNote(dashboardNote, error.message, "error");
    return;
  }

  const collection = table === "quote_requests" ? quotes : applications;
  const row = collection.find((item) => item.id === id);
  if (row) row.status = status;

  setNote(dashboardNote, "Status updated.", "success");
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

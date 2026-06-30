const states = [
  { name: "Lagos", center: [6.5244, 3.3792], areas: ["Ikeja", "Lekki", "Yaba", "Surulere", "Ajah"] },
  { name: "Abuja/FCT", center: [9.0765, 7.3986], areas: ["Wuse", "Garki", "Maitama", "Gwarinpa", "Lugbe"] },
  { name: "Edo", center: [6.335, 5.6037], areas: ["Benin City", "Ekpoma", "Auchi", "Uromi"] },
  { name: "Ogun", center: [7.1608, 3.3483], areas: ["Abeokuta", "Sango Ota", "Ijebu Ode", "Sagamu"] },
  { name: "Delta", center: [5.704, 5.9339], areas: ["Warri", "Asaba", "Sapele", "Ughelli"] },
  { name: "Rivers", center: [4.8156, 7.0498], areas: ["Port Harcourt", "Obio-Akpor", "Bonny", "Eleme"] },
];

const categories = [
  ["Electrician", "Power, wiring, repairs"],
  ["Plumber", "Leaks, fittings, water systems"],
  ["Tailor", "Fashion, uniforms, alterations"],
  ["Mechanic", "Vehicle repair and diagnostics"],
  ["AC Technician", "Cooling, servicing, installation"],
  ["Carpenter", "Furniture, fittings, woodwork"],
  ["Painter", "Homes, offices, finishing"],
  ["Solar Installer", "Inverters, panels, batteries"],
];

const demoArtisans = [
  ["Lagos", "Ikeja", "Electrician", "Tunde Bright Electricals", 6.6018, 3.3515, 4.9, 22, "12 min", "Verified"],
  ["Lagos", "Lekki", "AC Technician", "Kemi CoolFix Services", 6.4698, 3.5852, 4.8, 18, "18 min", "Pro"],
  ["Lagos", "Yaba", "Tailor", "Ayo Urban Stitches", 6.5145, 3.3896, 4.7, 31, "20 min", "Verified"],
  ["Abuja/FCT", "Wuse", "Plumber", "Musa FlowMaster", 9.0833, 7.4667, 4.9, 27, "15 min", "Verified"],
  ["Abuja/FCT", "Gwarinpa", "Solar Installer", "NorthLight Solar Works", 9.1099, 7.4042, 4.8, 16, "24 min", "Pro"],
  ["Abuja/FCT", "Garki", "Painter", "FCT Prime Finishers", 9.0339, 7.4898, 4.6, 20, "21 min", "Basic"],
  ["Edo", "Benin City", "Carpenter", "Osas FineWood Studio", 6.3349, 5.6037, 4.9, 34, "17 min", "Verified"],
  ["Edo", "Auchi", "Mechanic", "Ibrahim AutoCare", 7.0676, 6.2636, 4.7, 19, "29 min", "Verified"],
  ["Edo", "Ekpoma", "Tailor", "Grace Fit & Sew", 6.742, 6.139, 4.8, 25, "25 min", "Pro"],
  ["Ogun", "Abeokuta", "Plumber", "RockCity Pipe Works", 7.1475, 3.3619, 4.7, 15, "19 min", "Verified"],
  ["Ogun", "Sango Ota", "Electrician", "Ota Smart Wiring", 6.6899, 3.232, 4.8, 29, "16 min", "Pro"],
  ["Ogun", "Sagamu", "Painter", "Remo Finish Crew", 6.8322, 3.6319, 4.5, 11, "33 min", "Basic"],
  ["Delta", "Warri", "Mechanic", "Efe Rapid Motors", 5.5167, 5.75, 4.9, 41, "14 min", "Pro"],
  ["Delta", "Asaba", "Electrician", "Nedu PowerCare", 6.1985, 6.7319, 4.8, 26, "22 min", "Verified"],
  ["Delta", "Sapele", "Carpenter", "Delta Woodline", 5.8941, 5.6767, 4.6, 13, "35 min", "Basic"],
  ["Rivers", "Port Harcourt", "AC Technician", "PH CoolRoom Experts", 4.8156, 7.0498, 4.9, 37, "13 min", "Pro"],
  ["Rivers", "Obio-Akpor", "Plumber", "Rivers LeakStop", 4.8678, 7.012, 4.8, 23, "20 min", "Verified"],
  ["Rivers", "Eleme", "Solar Installer", "GreenPort Energy", 4.7857, 7.1206, 4.7, 17, "28 min", "Verified"],
].map(([state, area, category, name, lat, lng, rating, jobs, response, plan], index) => ({
  id: index + 1,
  state,
  area,
  category,
  name,
  lat,
  lng,
  rating,
  jobs,
  response,
  plan,
  initials: name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join(""),
  bio: `${name} is a ${plan.toLowerCase()} ${category.toLowerCase()} serving ${area} and nearby communities with verified FixAm 9ja marketplace signals.`,
  skills: serviceSkills(category),
  availability: index % 3 === 0 ? "Available today" : index % 3 === 1 ? "Available this week" : "Taking scheduled jobs",
  radius: 8 + (index % 5) * 3,
  completed: jobs + 14 + index,
  verification: ["Phone checked", "Location checked", plan === "Basic" ? "Profile reviewed" : "ID reviewed"],
  portfolio: portfolioFor(category),
}));

let artisans = [...demoArtisans];

function serviceSkills(category) {
  const skills = {
    Electrician: ["House wiring", "Fault tracing", "Inverter setup"],
    "AC Technician": ["AC servicing", "Gas refill", "Installation"],
    Tailor: ["Native wear", "Alterations", "Uniforms"],
    Plumber: ["Leak repair", "Pipe fitting", "Pump setup"],
    "Solar Installer": ["Panel setup", "Battery wiring", "Load audit"],
    Painter: ["Interior finish", "Exterior painting", "Wall prep"],
    Carpenter: ["Cabinets", "Doors", "Furniture repair"],
    Mechanic: ["Diagnostics", "Engine service", "Brake repair"],
  };
  return skills[category] || ["Inspection", "Repairs", "Installation"];
}

function portfolioFor(category) {
  return [`${category} inspection`, "Completed customer job", "Tools and work setup"];
}

const originByState = Object.fromEntries(states.map((state) => [state.name, state.center]));
let activeOrigin = originByState.Lagos;
let markers = [];
let reviewStatsByArtisanId = new Map();
let qualityByArtisanId = new Map();
const artisanIcon = L.divIcon({
  className: "map-pin",
  html: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const stateFilter = document.querySelector("#stateFilter");
const areaFilter = document.querySelector("#areaFilter");
const serviceSearch = document.querySelector("#serviceSearch");
const sortFilter = document.querySelector("#sortFilter");
const artisanList = document.querySelector("#artisanList");
const resultCount = document.querySelector("#resultCount");
const activeRegion = document.querySelector("#activeRegion");
const mapStatus = document.querySelector("#mapStatus");
const profileModal = document.querySelector("#profileModal");
const quoteModal = document.querySelector("#quoteModal");
const profileContent = document.querySelector("#profileContent");
const quoteForm = document.querySelector("#quoteForm");
const quoteArtisanText = document.querySelector("#quoteArtisanText");
const quoteNote = document.querySelector("#quoteNote");
const quoteSubmitButton = quoteForm.querySelector("button[type='submit']");
const joinForm = document.querySelector("#joinForm");
const joinState = document.querySelector("#joinState");
const joinArea = document.querySelector("#joinArea");
const joinNote = document.querySelector("#joinNote");
const joinSubmitButton = joinForm.querySelector("button[type='submit']");
let selectedQuoteArtisan = null;

const supabaseSettings = window.FIXAM_SUPABASE || {};
const supabaseClient =
  window.supabase && supabaseSettings.url && supabaseSettings.anonKey
    ? window.supabase.createClient(supabaseSettings.url, supabaseSettings.anonKey)
    : null;

states.forEach((state) => {
  stateFilter.add(new Option(state.name, state.name));
  joinState.add(new Option(state.name, state.name));
});

document.querySelector("#stateGrid").innerHTML = states
  .map(
    (state) => `
      <article class="state-card">
        <h3>${state.name}</h3>
        <p>${state.areas.join(", ")} and nearby communities.</p>
        <button type="button" data-state="${state.name}">Explore ${state.name}</button>
      </article>
    `,
  )
  .join("");

document.querySelector("#categoryGrid").innerHTML = categories
  .map(
    ([name, text]) => `
      <article class="category-card">
        <span class="category-icon">${name.slice(0, 2)}</span>
        <h3>${name}</h3>
        <p>${text}</p>
      </article>
    `,
  )
  .join("");

const map = L.map("map", { scrollWheelZoom: false }).setView(states[0].center, 11);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function milesBetween([lat1, lon1], [lat2, lon2]) {
  const radius = 3958.8;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function syncAreas() {
  const selected = states.find((state) => state.name === stateFilter.value);
  areaFilter.innerHTML = "";
  areaFilter.add(new Option("All areas", "All"));
  selected.areas.forEach((area) => areaFilter.add(new Option(area, area)));
  activeOrigin = selected.center;
}

function syncJoinAreas() {
  const selected = states.find((state) => state.name === joinState.value);
  joinArea.innerHTML = "";
  selected.areas.forEach((area) => joinArea.add(new Option(area, area)));
}

function filteredArtisans() {
  const query = serviceSearch.value.trim().toLowerCase();
  const selectedState = stateFilter.value;
  const selectedArea = areaFilter.value;

  return artisans
    .filter((artisan) => !["removed", "suspended"].includes(qualityByArtisanId.get(artisan.id)?.standing))
    .filter((artisan) => artisan.state === selectedState)
    .filter((artisan) => selectedArea === "All" || artisan.area === selectedArea)
    .filter((artisan) => {
      const haystack = `${artisan.category} ${artisan.name} ${artisan.area}`.toLowerCase();
      return !query || haystack.includes(query);
    })
    .map((artisan) => ({
      ...artisan,
      distance: milesBetween(activeOrigin, [artisan.lat, artisan.lng]),
    }))
    .sort((a, b) => {
      if (sortFilter.value === "rating") return b.rating - a.rating;
      if (sortFilter.value === "response") return parseInt(a.response, 10) - parseInt(b.response, 10);
      return a.distance - b.distance;
    });
}

function renderCards(matches) {
  resultCount.textContent = `${matches.length} artisan${matches.length === 1 ? "" : "s"}`;
  activeRegion.textContent = `${stateFilter.value}${areaFilter.value !== "All" ? `, ${areaFilter.value}` : ""}`;

  artisanList.innerHTML =
    matches
      .map(
        (artisan) => `
          <article class="artisan-card">
            <div class="artisan-top">
              <div>
                <h3>${artisan.name}</h3>
                <p>${artisan.category} in ${artisan.area}</p>
              </div>
              <span class="rating">${displayRating(artisan)}</span>
            </div>
            <div class="badge-row">
              <span class="badge ${artisan.plan === "Pro" ? "gold" : ""}">FixAm ${artisan.plan}</span>
              ${qualityBadge(artisan)}
              <span class="badge">${artisan.distance.toFixed(1)} miles away</span>
              <span class="badge">${artisan.jobs} jobs</span>
              <span class="badge">${artisan.response}</span>
            </div>
            <div class="card-actions">
              <button type="button" data-action="quote" data-artisan-id="${artisan.id}">Request quote</button>
              <button type="button" data-action="profile" data-artisan-id="${artisan.id}">View profile</button>
            </div>
          </article>
        `,
      )
      .join("") || `<article class="artisan-card"><h3>No matches yet</h3><p>Try another service or area.</p></article>`;
}

function renderMap(matches) {
  markers.forEach((marker) => marker.remove());
  markers = matches.map((artisan) =>
    L.marker([artisan.lat, artisan.lng], { icon: artisanIcon })
      .addTo(map)
      .bindPopup(
        `<span class="popup-title">${artisan.name}</span>${artisan.category}<br>${artisan.distance.toFixed(
          1,
        )} miles away`,
      ),
  );

  const selectedState = states.find((state) => state.name === stateFilter.value);
  map.invalidateSize();
  if (markers.length === 1) {
    map.setView([matches[0].lat, matches[0].lng], 12);
  } else if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.18));
  } else {
    map.setView(selectedState.center, 11);
  }

  mapStatus.textContent = `Showing ${matches.length} verified artisan${matches.length === 1 ? "" : "s"} near ${
    stateFilter.value
  }`;
}

function render() {
  const matches = filteredArtisans();
  renderCards(matches);
  renderMap(matches);
  requestAnimationFrame(() => map.invalidateSize());
}

window.addEventListener("resize", () => {
  requestAnimationFrame(() => map.invalidateSize());
});

stateFilter.addEventListener("change", () => {
  syncAreas();
  render();
});

joinState.addEventListener("change", syncJoinAreas);
areaFilter.addEventListener("change", render);
serviceSearch.addEventListener("input", render);
sortFilter.addEventListener("change", render);

document.querySelectorAll("[data-state]").forEach((button) => {
  button.addEventListener("click", () => {
    stateFilter.value = button.dataset.state;
    syncAreas();
    render();
    document.querySelector("#marketplace").scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelectorAll("[data-scroll-to]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.scrollTo}`).scrollIntoView({ behavior: "smooth" });
  });
});

document.querySelector("[data-focus-search]").addEventListener("click", () => {
  serviceSearch.focus();
});

document.querySelector("#locateButton").addEventListener("click", () => {
  activeOrigin = originByState[stateFilter.value];
  render();
});

artisanList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action][data-artisan-id]");
  if (!button) return;

  const artisan = artisans.find((item) => item.id === Number(button.dataset.artisanId));
  if (!artisan) return;

  if (button.dataset.action === "profile") {
    openProfile(artisan);
  } else {
    openQuote(artisan);
  }
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModals);
});

[profileModal, quoteModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModals();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
});

quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedQuoteArtisan) return;

  const requestId = `F9-${String(selectedQuoteArtisan.id).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;
  const payload = {
    request_code: requestId,
    artisan_id: selectedQuoteArtisan.id,
    artisan_name: selectedQuoteArtisan.name,
    artisan_category: selectedQuoteArtisan.category,
    artisan_state: selectedQuoteArtisan.state,
    artisan_area: selectedQuoteArtisan.area,
    customer_name: document.querySelector("#quoteName").value.trim(),
    customer_phone: document.querySelector("#quotePhone").value.trim(),
    job_location: document.querySelector("#quoteLocation").value.trim(),
    urgency: document.querySelector("#quoteUrgency").value,
    job_details: document.querySelector("#quoteDetails").value.trim(),
    source: "website",
  };

  setQuoteStatus("Sending request...", "");
  quoteSubmitButton.disabled = true;
  quoteSubmitButton.textContent = "Sending...";

  if (!supabaseClient) {
    setQuoteStatus(
      `Quote request ${requestId} prepared for ${selectedQuoteArtisan.name}. Add your Supabase URL and anon key to save it online.`,
      "success",
    );
    quoteSubmitButton.textContent = "Request prepared";
    quoteSubmitButton.disabled = false;
    return;
  }

  const { error } = await insertWithTimeout("quote_requests", payload);

  if (error) {
    setQuoteStatus(formatSubmitError(error), "error");
    quoteSubmitButton.textContent = "Try again";
    quoteSubmitButton.disabled = false;
    return;
  }

  setQuoteStatus(`Quote request ${requestId} sent to ${selectedQuoteArtisan.name}.`, "success");
  quoteSubmitButton.textContent = "Request sent";
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const applicationCode = `F9-A-${Date.now().toString().slice(-6)}`;
  const payload = {
    application_code: applicationCode,
    full_name: document.querySelector("#joinName").value.trim(),
    trade: document.querySelector("#joinTrade").value,
    state: joinState.value,
    area: joinArea.value,
    phone: document.querySelector("#joinPhone").value.trim(),
    preferred_plan: document.querySelector("#joinPlan").value,
    years_experience: Number(document.querySelector("#joinExperience").value),
    work_summary: document.querySelector("#joinDetails").value.trim(),
    source: "website",
  };

  setJoinStatus("Sending application...", "");
  joinSubmitButton.disabled = true;
  joinSubmitButton.textContent = "Sending...";

  if (!supabaseClient) {
    setJoinStatus(
      `Application ${applicationCode} prepared. Add your Supabase URL and anon key to save it online.`,
      "success",
    );
    joinSubmitButton.textContent = "Application prepared";
    joinSubmitButton.disabled = false;
    return;
  }

  const { error } = await insertWithTimeout("artisan_applications", payload);

  if (error) {
    setJoinStatus(formatSubmitError(error), "error");
    joinSubmitButton.textContent = "Try again";
    joinSubmitButton.disabled = false;
    return;
  }

  setJoinStatus(`Application ${applicationCode} received. FixAm 9ja will review it before listing.`, "success");
  joinSubmitButton.textContent = "Application sent";
  joinForm.reset();
  syncJoinAreas();
});

async function loadTrustSignals() {
  if (!supabaseClient) return;

  const [reviewResult, qualityResult] = await Promise.all([
    supabaseClient
      .from("artisan_reviews")
      .select("artisan_id, rating, would_recommend, comment, created_at, visibility")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseClient.from("artisan_quality_controls").select("artisan_id, standing, admin_note"),
  ]);

  if (!reviewResult.error) {
    reviewStatsByArtisanId = buildReviewStats(reviewResult.data || []);
  }

  if (!qualityResult.error) {
    qualityByArtisanId = new Map((qualityResult.data || []).map((item) => [item.artisan_id, item]));
  }

}

async function loadRealArtisans() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("artisans")
    .select(
      "id, state, area, category, business_name, lat, lng, rating, jobs, response_time, plan, bio, skills, availability, service_radius, completed_jobs, verification_checks, portfolio_items, profile_status",
    )
    .eq("profile_status", "active")
    .order("business_name");

  if (error || !data?.length) {
    return;
  }

  artisans = data.map((artisan) => ({
    id: artisan.id,
    state: artisan.state,
    area: artisan.area,
    category: artisan.category,
    name: artisan.business_name,
    lat: Number(artisan.lat),
    lng: Number(artisan.lng),
    rating: Number(artisan.rating || 4.5),
    jobs: Number(artisan.jobs || 0),
    response: artisan.response_time || "30 min",
    plan: artisan.plan || "Basic",
    initials: artisan.business_name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join(""),
    bio:
      artisan.bio ||
      `${artisan.business_name} is a ${artisan.category.toLowerCase()} serving ${artisan.area}, ${artisan.state}.`,
    skills: artisan.skills?.length ? artisan.skills : serviceSkills(artisan.category),
    availability: artisan.availability || "Taking scheduled jobs",
    radius: Number(artisan.service_radius || 10),
    completed: Number(artisan.completed_jobs || artisan.jobs || 0),
    verification: artisan.verification_checks?.length ? artisan.verification_checks : ["Profile reviewed"],
    portfolio: artisan.portfolio_items?.length ? artisan.portfolio_items : portfolioFor(artisan.category),
  }));

  syncAreas();
}

function buildReviewStats(reviews) {
  const stats = new Map();

  reviews.forEach((review) => {
    const current = stats.get(review.artisan_id) || {
      count: 0,
      total: 0,
      recommend: 0,
      latest: [],
    };
    current.count += 1;
    current.total += review.rating;
    if (review.would_recommend) current.recommend += 1;
    if (current.latest.length < 2) current.latest.push(review);
    stats.set(review.artisan_id, current);
  });

  return stats;
}

function displayRating(artisan) {
  const stats = reviewStatsByArtisanId.get(artisan.id);
  if (!stats) return `★ ${artisan.rating}`;
  return `★ ${(stats.total / stats.count).toFixed(1)} (${stats.count})`;
}

function qualityBadge(artisan) {
  const standing = qualityByArtisanId.get(artisan.id)?.standing;
  if (!standing || standing === "active") return "";
  return `<span class="badge ${standing === "warning" ? "gold" : ""}">${standing}</span>`;
}

function reviewSummary(artisan) {
  const stats = reviewStatsByArtisanId.get(artisan.id);
  if (!stats) {
    return `<p>No customer reviews yet. Ratings will update automatically after verified customers submit reviews.</p>`;
  }

  const average = (stats.total / stats.count).toFixed(1);
  const recommendRate = Math.round((stats.recommend / stats.count) * 100);
  const latest = stats.latest
    .map((review) => `<article><strong>★ ${review.rating}</strong><small>${escapeHtml(review.comment)}</small></article>`)
    .join("");

  return `
    <div class="profile-metrics compact">
      <span><strong>${average}</strong> Customer rating</span>
      <span><strong>${stats.count}</strong> Reviews</span>
      <span><strong>${recommendRate}%</strong> Recommend</span>
    </div>
    <div class="portfolio-grid">${latest}</div>
  `;
}

function setQuoteStatus(message, type) {
  quoteNote.textContent = message;
  quoteNote.classList.remove("success-note", "error-note");
  if (type === "success") quoteNote.classList.add("success-note");
  if (type === "error") quoteNote.classList.add("error-note");
}

function setJoinStatus(message, type) {
  joinNote.textContent = message;
  joinNote.classList.remove("success-note", "error-note");
  if (type === "success") joinNote.classList.add("success-note");
  if (type === "error") joinNote.classList.add("error-note");
}

async function insertWithTimeout(table, payload) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    return await supabaseClient.from(table).insert(payload).abortSignal(controller.signal);
  } catch (error) {
    return { error };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatSubmitError(error) {
  return error.name === "AbortError"
    ? "The request took too long. Please check your connection and try again."
    : `We could not save this yet: ${error.message}`;
}

function openProfile(artisan) {
  profileContent.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${artisan.initials}</div>
      <div>
        <p class="eyebrow">${artisan.category} in ${artisan.area}</p>
        <h2 id="profileTitle">${artisan.name}</h2>
        <p>${artisan.bio}</p>
      </div>
    </div>
    <div class="profile-metrics">
      <span><strong>${artisan.rating}</strong> Rating</span>
      <span><strong>${displayRating(artisan).replace("★ ", "")}</strong> Live rating</span>
      <span><strong>${artisan.completed}</strong> Completed jobs</span>
      <span><strong>${artisan.response}</strong> Response</span>
      <span><strong>${artisan.radius} mi</strong> Service radius</span>
    </div>
    <div class="profile-grid">
      <section>
        <h3>Skills</h3>
        <div class="badge-row">${artisan.skills.map((skill) => `<span class="badge">${skill}</span>`).join("")}</div>
      </section>
      <section>
        <h3>Verification</h3>
        <div class="check-list">${artisan.verification.map((item) => `<span>${item}</span>`).join("")}</div>
      </section>
      <section>
        <h3>Portfolio</h3>
        <div class="portfolio-grid">${artisan.portfolio
          .map((item) => `<article><strong>${item}</strong><small>${artisan.area}, ${artisan.state}</small></article>`)
          .join("")}</div>
      </section>
      <section>
        <h3>Availability</h3>
        <p>${artisan.availability}. Typical first response is ${artisan.response.toLowerCase()}.</p>
      </section>
      <section>
        <h3>Customer reviews</h3>
        ${reviewSummary(artisan)}
      </section>
    </div>
    <div class="profile-actions">
      <button class="primary-action large" type="button" data-profile-quote="${artisan.id}">Request quote</button>
      <button class="secondary-action large" type="button" data-close-modal>Back to results</button>
    </div>
  `;

  profileContent.querySelector("[data-profile-quote]").addEventListener("click", () => openQuote(artisan));
  profileContent.querySelector("[data-close-modal]").addEventListener("click", closeModals);
  showModal(profileModal);
}

function openQuote(artisan) {
  selectedQuoteArtisan = artisan;
  quoteArtisanText.textContent = `Requesting ${artisan.category.toLowerCase()} support from ${artisan.name} in ${artisan.area}, ${artisan.state}.`;
  setQuoteStatus("Your request will be saved once the FixAm 9ja database is connected.", "");
  quoteForm.reset();
  quoteSubmitButton.disabled = false;
  quoteSubmitButton.textContent = "Send quote request";
  showModal(quoteModal);
  document.querySelector("#quoteName").focus();
}

function showModal(modal) {
  closeModals();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModals() {
  [profileModal, quoteModal].forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
  document.body.classList.remove("modal-open");
}

syncAreas();
syncJoinAreas();
render();
initializeDirectory();

async function initializeDirectory() {
  await Promise.all([loadRealArtisans(), loadTrustSignals()]);
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

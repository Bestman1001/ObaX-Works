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

const artisans = [
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
}));

const originByState = Object.fromEntries(states.map((state) => [state.name, state.center]));
let activeOrigin = originByState.Lagos;
let markers = [];
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

states.forEach((state) => {
  stateFilter.add(new Option(state.name, state.name));
  document.querySelector("#joinState").add(new Option(state.name, state.name));
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

function filteredArtisans() {
  const query = serviceSearch.value.trim().toLowerCase();
  const selectedState = stateFilter.value;
  const selectedArea = areaFilter.value;

  return artisans
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
              <span class="rating">★ ${artisan.rating}</span>
            </div>
            <div class="badge-row">
              <span class="badge ${artisan.plan === "Pro" ? "gold" : ""}">FixAm ${artisan.plan}</span>
              <span class="badge">${artisan.distance.toFixed(1)} miles away</span>
              <span class="badge">${artisan.jobs} jobs</span>
              <span class="badge">${artisan.response}</span>
            </div>
            <div class="card-actions">
              <button type="button">Request quote</button>
              <button type="button">View profile</button>
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

syncAreas();
render();

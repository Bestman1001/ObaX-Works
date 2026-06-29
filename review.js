const settings = window.FIXAM_SUPABASE || {};
const supabaseClient =
  window.supabase && settings.url && settings.anonKey
    ? window.supabase.createClient(settings.url, settings.anonKey)
    : null;

const params = new URLSearchParams(window.location.search);
const context = {
  token: params.get("token") || "",
  quoteId: params.get("quote_id") || "",
  artisanId: Number(params.get("artisan_id") || 0),
  artisanName: params.get("artisan_name") || "this artisan",
  artisanCategory: params.get("artisan_category") || "Artisan",
  artisanState: params.get("artisan_state") || "",
  artisanArea: params.get("artisan_area") || "",
};

const reviewForm = document.querySelector("#reviewForm");
const reviewNote = document.querySelector("#reviewNote");
const reviewContext = document.querySelector("#reviewContext");
const submitButton = reviewForm.querySelector("button[type='submit']");

reviewContext.textContent = `You are reviewing ${context.artisanName} for ${context.artisanCategory} support in ${context.artisanArea}, ${context.artisanState}.`;

if (!context.token || !context.artisanId) {
  setNote("This review link is incomplete. Ask FixAm 9ja for a fresh review link.", "error");
  submitButton.disabled = true;
}

if (!supabaseClient) {
  setNote("Supabase is not configured yet. Reviews cannot be saved.", "error");
  submitButton.disabled = true;
}

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient || !context.token || !context.artisanId) return;

  const payload = {
    review_token: context.token,
    quote_request_id: context.quoteId || null,
    artisan_id: context.artisanId,
    artisan_name: context.artisanName,
    artisan_category: context.artisanCategory,
    artisan_state: context.artisanState,
    artisan_area: context.artisanArea,
    customer_name: document.querySelector("#customerName").value.trim(),
    rating: Number(document.querySelector("#rating").value),
    quality_rating: Number(document.querySelector("#qualityRating").value),
    timeliness_rating: Number(document.querySelector("#timelinessRating").value),
    professionalism_rating: Number(document.querySelector("#professionalismRating").value),
    price_fairness_rating: Number(document.querySelector("#priceRating").value),
    would_recommend: document.querySelector("#wouldRecommend").value === "true",
    comment: document.querySelector("#comment").value.trim(),
    visibility: "public",
  };

  setNote("Publishing your review...", "");
  submitButton.disabled = true;
  submitButton.textContent = "Publishing...";

  const { error } = await supabaseClient.from("artisan_reviews").insert(payload);

  if (error) {
    const message = error.code === "23505" ? "This review link has already been used." : error.message;
    setNote(message, "error");
    submitButton.disabled = false;
    submitButton.textContent = "Publish review";
    return;
  }

  setNote("Thank you. Your review is now public and will update this artisan's rating.", "success");
  submitButton.textContent = "Review published";
  reviewForm.reset();
});

function setNote(message, type) {
  reviewNote.textContent = message;
  reviewNote.classList.remove("success-note", "error-note");
  if (type === "success") reviewNote.classList.add("success-note");
  if (type === "error") reviewNote.classList.add("error-note");
}

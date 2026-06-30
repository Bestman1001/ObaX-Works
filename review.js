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

  const mediaFiles = selectedFiles("#reviewMedia");
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
    customer_user_id: await currentUserId(),
    media_count: mediaFiles.length,
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

  const mediaResult = await uploadMediaFiles({
    files: mediaFiles,
    folder: `reviews/${context.token}`,
    entityType: "customer_review",
    entityId: context.token,
    role: "customer",
  });

  setNote(
    mediaResult.error
      ? `Your review is public, but media upload needs retry: ${mediaResult.error}`
      : `Thank you. Your review is now public with ${mediaResult.count} media file${
          mediaResult.count === 1 ? "" : "s"
        } attached.`,
    mediaResult.error ? "error" : "success",
  );
  submitButton.textContent = "Review published";
  reviewForm.reset();
});

async function currentUserId() {
  if (!supabaseClient) return null;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  return user?.id || null;
}

function selectedFiles(selector) {
  const input = document.querySelector(selector);
  return input ? [...input.files].slice(0, 4) : [];
}

async function uploadMediaFiles({ files, folder, entityType, entityId, role }) {
  if (!supabaseClient || !files.length) return { count: 0 };

  const uploadedBy = await currentUserId();
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
      uploaded_by_user_id: uploadedBy,
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

function setNote(message, type) {
  reviewNote.textContent = message;
  reviewNote.classList.remove("success-note", "error-note");
  if (type === "success") reviewNote.classList.add("success-note");
  if (type === "error") reviewNote.classList.add("error-note");
}

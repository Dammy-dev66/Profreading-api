(function () {
  const WEBHOOK_URL = "https://hook.eu1.make.com/tnxiqbhiucio14474kmex2uh5ic7o14n";
  const DOCUMENT_API_URL = "https://profreading-api.vercel.app/api/convert";
  const PAYMENT_SUCCESS_URL = "https://profreading-api.vercel.app/proofing-success.html";

  const form = document.getElementById("fbProofForm");
  if (!form) return;

  const $ = (selector) => form.querySelector(selector);
  const $$ = (selector) => Array.from(form.querySelectorAll(selector));
  const text = $("#fbProofText");
  const wordCount = $("#fbWordCount");
  const cost = $("#fbCost");
  const wordCountInput = $("#fbWordCountInput");
  const costInput = $("#fbCostInput");
  const serviceLevelInput = $("#fbServiceLevel");
  const englishPreferenceInput = $("#fbEnglishPreference");
  const consent = $("#fbReviewConsent");
  const paymentAck = $("#fbPaymentAck");
  const submit = $(".fb-submit");
  const fileInput = $('input[name="uploaded_document"]');
  const uploadBox = $(".fb-upload");
  const uploadLabel = $(".fb-upload span");
  const uploadStatus = $("#fbUploadStatus");
  const uploadTitle = $("#fbUploadTitle");
  const uploadMessage = $("#fbUploadMessage");

  let rate = 0.05;
  let uploadedDocumentText = "";
  let useUploadedDocumentText = false;
  let reviewModal;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createReviewModal() {
    if (reviewModal) return reviewModal;

    const style = document.createElement("style");
    style.textContent = `
      .fb-review-modal { position: fixed; inset: 0; z-index: 100000; display: grid; place-items: center; padding: 20px; background: rgba(7, 28, 67, .42); }
      .fb-review-modal[hidden] { display: none; }
      .fb-review-dialog { width: min(620px, 100%); max-height: min(760px, 92vh); overflow: auto; padding: 28px; border: 1px solid #d9d0c2; background: #fffdfa; color: #071c43; box-shadow: 0 18px 60px rgba(7, 28, 67, .2); }
      .fb-review-dialog h2 { margin: 0 0 8px; font: 400 30px/1.1 Georgia, serif; }
      .fb-review-lede { margin: 0 0 20px; color: #334d73; font: 14px/1.6 Arial, sans-serif; }
      .fb-review-list { display: grid; grid-template-columns: minmax(130px, .7fr) 1.3fr; gap: 0; margin: 0 0 24px; border-top: 1px solid #d9d0c2; }
      .fb-review-list dt, .fb-review-list dd { margin: 0; padding: 12px 0; border-bottom: 1px solid #d9d0c2; font: 14px/1.45 Arial, sans-serif; }
      .fb-review-list dt { color: #56616d; }
      .fb-review-list dd { font-weight: 700; overflow-wrap: anywhere; }
      .fb-review-actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .fb-review-actions button { min-height: 48px; padding: 0 18px; border: 1px solid #dda31d; font: 700 11px/1 Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; cursor: pointer; }
      .fb-review-edit { background: transparent; color: #071c43; }
      .fb-review-pay { background: #dda31d; color: #fff; }
      @media (max-width: 560px) { .fb-review-list { grid-template-columns: 1fr; } .fb-review-list dt { padding-bottom: 2px; border-bottom: 0; } .fb-review-list dd { padding-top: 2px; } .fb-review-actions { flex-direction: column; } }
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement("div");
    wrapper.className = "fb-review-modal";
    wrapper.hidden = true;
    wrapper.setAttribute("role", "presentation");
    wrapper.innerHTML = `
      <div class="fb-review-dialog" role="dialog" aria-modal="true" aria-labelledby="fbReviewTitle">
        <div class="fb-eyebrow">Final check</div>
        <h2 id="fbReviewTitle">You are requesting</h2>
        <p class="fb-review-lede">Please check these details before continuing to payment.</p>
        <dl class="fb-review-list" id="fbReviewList"></dl>
        <div class="fb-review-actions">
          <button class="fb-review-edit" type="button" id="fbReviewEdit">Go back and change details</button>
          <button class="fb-review-pay" type="button" id="fbReviewPay">Continue to payment</button>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    wrapper.querySelector("#fbReviewEdit").addEventListener("click", () => {
      wrapper.hidden = true;
      submit.focus();
    });
    wrapper.querySelector("#fbReviewPay").addEventListener("click", () => {
      wrapper.hidden = true;
      createPaymentPage();
    });
    reviewModal = wrapper;
    return wrapper;
  }

  function reviewValue(value, fallback) {
    return value ? escapeHtml(value) : escapeHtml(fallback || "Not provided");
  }

  function showReviewModal() {
    const modal = createReviewModal();
    const selectedService = serviceLevelInput.value || "Premium";
    const wordLimit = document.getElementById("fbWordCountLimit")?.value.trim() || "No limit provided";
    const clientName = form.querySelector('[name="client_name"]')?.value.trim();
    const clientEmail = form.querySelector('[name="client_email"]')?.value.trim();
    const deadline = document.getElementById("fbDeadline")?.value || "Not provided";
    const instructions = form.querySelector('[name="additional_editing_instructions"]')?.value.trim();
    const documentName = fileInput.files[0]?.name || "Pasted text";
    modal.querySelector("#fbReviewTitle").textContent = "You are requesting " + selectedService + ".";
    modal.querySelector("#fbReviewList").innerHTML = `
      <dt>Document</dt><dd>${reviewValue(documentName)}</dd>
      <dt>Word count</dt><dd>${reviewValue(wordCountInput.value, "0")}</dd>
      <dt>Word count limit</dt><dd>${reviewValue(wordLimit)}</dd>
      <dt>Estimated price</dt><dd>${reviewValue(costInput.value, "€0.00")}</dd>
      <dt>Completion deadline</dt><dd>${reviewValue(deadline)}</dd>
      <dt>Email</dt><dd>${reviewValue(clientEmail)}</dd>
      <dt>Name</dt><dd>${reviewValue(clientName)}</dd>
      <dt>Instructions</dt><dd>${reviewValue(instructions, "None provided")}</dd>`;
    modal.hidden = false;
    modal.querySelector("#fbReviewEdit").focus();
  }

  async function createPaymentPage() {
    submit.disabled = true;
    submit.textContent = "Creating payment...";

    try {
      const formData = new FormData(form);
      formData.set("pasted_text", useUploadedDocumentText ? uploadedDocumentText : text.value);
      formData.set("word_count", wordCountInput.value);
      formData.set("calculated_price", costInput.value);
      formData.set("service_level", serviceLevelInput.value);
      formData.set("english_preference", englishPreferenceInput.value);
      formData.set("submission_date", new Date().toISOString());
      formData.set("request_status", "New");
      formData.set("success_url", PAYMENT_SUCCESS_URL);

      const response = await fetch(WEBHOOK_URL, { method: "POST", body: formData });
      let result = {};
      try { result = await response.json(); } catch { throw new Error("Make did not return JSON."); }
      if (!response.ok || !result.success || !result.checkout_url) {
        throw new Error(result.error || "Payment link was not created.");
      }
      submit.textContent = "Redirecting to payment...";
      window.location.href = result.checkout_url;
    } catch (error) {
      console.error(error);
      alert("Something went wrong while creating the payment page. Please try again.");
      submit.textContent = "Submit for payment";
      updateSubmitState();
    }
  }

  function countWords(value) {
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  function updateEstimate() {
    const estimateSource = useUploadedDocumentText ? uploadedDocumentText : text.value;
    const words = estimateSource.trim() ? countWords(estimateSource) : 0;
    const total = "€" + (words * rate).toFixed(2);
    wordCount.textContent = words;
    cost.textContent = total;
    wordCountInput.value = words;
    costInput.value = total;
  }

  function updateSubmitState() {
    submit.disabled = !(consent.checked && paymentAck.checked);
  }

  function uploadState(state, title, message) {
    uploadBox.classList.remove("is-reading", "is-success", "is-error");
    uploadStatus.classList.remove("is-reading", "is-success", "is-error");
    uploadStatus.classList.add("is-visible");
    if (state) {
      uploadBox.classList.add("is-" + state);
      uploadStatus.classList.add("is-" + state);
    }
    uploadTitle.textContent = title;
    uploadMessage.textContent = message;
  }

  $$(".fb-service-grid button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".fb-service-grid button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      rate = Number(button.dataset.rate);
      serviceLevelInput.value = button.dataset.service;
      updateEstimate();
    });
  });

  $$(".fb-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".fb-toggle button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      englishPreferenceInput.value = button.dataset.preference;
    });
  });

  text.addEventListener("input", () => {
    if (useUploadedDocumentText && document.activeElement !== text) {
      text.value = uploadedDocumentText;
      updateEstimate();
      return;
    }

    useUploadedDocumentText = false;
    uploadedDocumentText = "";
    updateEstimate();
  });
  text.addEventListener("keyup", updateEstimate);
  text.addEventListener("paste", () => setTimeout(updateEstimate, 0));
  consent.addEventListener("change", updateSubmitState);
  paymentAck.addEventListener("change", updateSubmitState);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) {
      uploadedDocumentText = "";
      useUploadedDocumentText = false;
      uploadLabel.textContent = "Drag & drop, or click to upload";
      uploadState("", "Ready for a document", "Upload a DOCX, text-based PDF, or TXT file to calculate the word count.");
      return;
    }

    uploadLabel.textContent = file.name;
    uploadState("reading", "Reading document...", "Extracting text from " + file.name + ". This usually takes a few seconds.");

    const documentData = new FormData();
    documentData.append("uploaded_document", file);

    try {
      const response = await fetch(DOCUMENT_API_URL, { method: "POST", body: documentData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not read document.");

      uploadedDocumentText = result.text;
      useUploadedDocumentText = true;
      text.value = result.text;
      updateEstimate();
      uploadState("success", "Document ready", file.name + " was read successfully. Estimated word count: " + wordCountInput.value + ". Estimated cost: " + costInput.value + ".");
    } catch (error) {
      console.error(error);
      uploadLabel.textContent = "Could not read document";
      uploadState("error", "Document could not be read", "Please upload a DOCX, text-based PDF, or TXT file. Scanned PDFs are not supported.");
      alert("This document could not be read. Please upload a DOCX, text-based PDF, or TXT file.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateEstimate();
    showReviewModal();
  });

  submit.textContent = "Submit for payment";

  updateEstimate();
  updateSubmitState();
})();

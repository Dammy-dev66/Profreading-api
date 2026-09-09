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
      // Make should map this value to Stripe Checkout's success URL.
      formData.set("success_url", PAYMENT_SUCCESS_URL);

      const response = await fetch(WEBHOOK_URL, { method: "POST", body: formData });
      let result = {};

      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error("Make did not return JSON.");
      }

      if (!response.ok || !result.success || !result.checkout_url) {
        throw new Error(result.error || "Payment link was not created.");
      }

      submit.textContent = "Redirecting to payment...";
      window.location.href = result.checkout_url;
    } catch (error) {
      console.error(error);
      alert("Something went wrong while creating the payment page. Please try again.");
      submit.textContent = "Submit for review ↗";
      updateSubmitState();
    }
  });

  updateEstimate();
  updateSubmitState();
})();

(function () {
  "use strict";

  const WEBHOOK_URL = "https://hook.eu1.make.com/tnxiqbhiucio14474kmex2uh5ic7o14n";
  const DOCUMENT_API_URL = "https://profreading-api.vercel.app/api/convert";
  const PAYMENT_SUCCESS_URL = "https://profreading-api.vercel.app/proofing-success.html";
  const EDITOR_ZONE = "Europe/Dublin";
  const STORAGE_KEY = "fb-proof-client-details";

  function start() {
    const form = document.getElementById("fbProofForm");
    if (!form || form.dataset.proofReady === "true") return;
    form.dataset.proofReady = "true";

    const $ = (selector) => form.querySelector(selector);
    const $$ = (selector) => Array.from(form.querySelectorAll(selector));
    const text = $("#fbProofText");
    const wordCount = $("#fbWordCount");
    const cost = $("#fbCost");
    const wordCountInput = $("#fbWordCountInput");
    const costInput = $("#fbCostInput");
    const serviceLevelInput = $("#fbServiceLevel");
    const englishPreferenceInput = $("#fbEnglishPreference");
    const dateInput = $("#fbDeadlineDate");
    const timeInput = $("#fbDeadlineTime");
    const deadlineInput = $("#fbDeadline");
    const deadlineTimezoneInput = $("#fbDeadlineTimezone");
    const deadlineUtcInput = $("#fbDeadlineUtc");
    const deadlineDublinInput = $("#fbDeadlineDublinLocal");
    const consent = $("#fbReviewConsent");
    const paymentAck = $("#fbPaymentAck");
    const submit = $(".fb-submit");
    const fileInput = $('input[name="uploaded_document"]');
    const uploadBox = $(".fb-upload");
    const uploadLabel = $("#fbUploadLabel");
    const uploadStatus = $("#fbUploadStatus");
    const uploadTitle = $("#fbUploadTitle");
    const uploadMessage = $("#fbUploadMessage");
    const modal = document.getElementById("fbReviewModal");
    const reviewList = document.getElementById("fbReviewList");
    const editButton = document.getElementById("fbReviewEdit");
    const payButton = document.getElementById("fbReviewPay");
    const closeButton = modal && modal.querySelector(".fb-review-close");

    const requiredNodes = [text, wordCount, cost, wordCountInput, costInput, serviceLevelInput,
      englishPreferenceInput, dateInput, timeInput, deadlineInput, deadlineTimezoneInput,
      deadlineUtcInput, deadlineDublinInput, consent, paymentAck, submit, fileInput,
      uploadBox, uploadLabel, uploadStatus, uploadTitle, uploadMessage, modal, reviewList,
      editButton, payButton, closeButton];
    if (requiredNodes.some((node) => !node)) {
      console.error("Proofreading form could not start because required markup is missing.");
      return;
    }

    let rate = 0.05;
    let uploadedDocumentText = "";
    let useUploadedDocumentText = false;
    let paymentPending = false;
    const clientZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    dateInput.required = false;
    timeInput.required = false;

    function countWords(value) {
      return value.trim().split(/\s+/).filter(Boolean).length;
    }

    function updateEstimate() {
      const source = useUploadedDocumentText ? uploadedDocumentText : text.value;
      const words = source.trim() ? countWords(source) : 0;
      const estimatedTotal = words ? Math.max(words * rate, 0.5) : 0;
      const total = "€" + estimatedTotal.toFixed(2);
      wordCount.textContent = String(words);
      cost.textContent = total;
      wordCountInput.value = String(words);
      costInput.value = total;
    }

    function updateEnglishPreference() {
      const selected = $$('[data-english-preference]:checked').map((input) => input.value);
      englishPreferenceInput.value = selected.join(" and ");
    }

    function zoneOffsetMinutes(date, timeZone) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).formatToParts(date).reduce((output, part) => {
        if (part.type !== "literal") output[part.type] = part.value;
        return output;
      }, {});
      const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second));
      return Math.round((asUtc - date.getTime()) / 60000);
    }

    function wallTimeToUtc(dateValue, timeValue, timeZone) {
      const guess = new Date(dateValue + "T" + timeValue + ":00Z");
      const firstOffset = zoneOffsetMinutes(guess, timeZone);
      let result = new Date(guess.getTime() - firstOffset * 60000);
      const correctedOffset = zoneOffsetMinutes(result, timeZone);
      if (correctedOffset !== firstOffset) {
        result = new Date(guess.getTime() - correctedOffset * 60000);
      }
      return result;
    }

    function updateDeadline() {
      const dateValue = dateInput.value;
      const timeValue = timeInput.value;
      deadlineInput.value = dateValue && timeValue ? dateValue + " " + timeValue : "";
      deadlineTimezoneInput.value = "";
      deadlineUtcInput.value = "";
      deadlineDublinInput.value = "";
      if (!dateValue || !timeValue) return false;

      const utcDate = wallTimeToUtc(dateValue, timeValue, clientZone);
      if (Number.isNaN(utcDate.getTime())) return false;
      deadlineTimezoneInput.value = clientZone;
      deadlineUtcInput.value = utcDate.toISOString();
      deadlineDublinInput.value = new Intl.DateTimeFormat("en-GB", {
        timeZone: EDITOR_ZONE,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "shortOffset"
      }).format(utcDate);
      return true;
    }

    function initializePickers() {
      const onChange = () => updateDeadline();
      if (typeof window.flatpickr === "function") {
        window.flatpickr(dateInput, {
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "j F Y",
          minDate: "today",
          disableMobile: true,
          onChange
        });
        window.flatpickr(timeInput, {
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          altInput: true,
          altFormat: "h:i K",
          time_24hr: false,
          disableMobile: true,
          onChange
        });
      } else {
        dateInput.type = "date";
        timeInput.type = "time";
      }
      dateInput.addEventListener("change", updateDeadline);
      timeInput.addEventListener("change", updateDeadline);
    }

    function partsFor(date, timeZone) {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "shortOffset"
      }).formatToParts(date).reduce((output, part) => {
        if (part.type !== "literal") output[part.type] = part.value;
        return output;
      }, {});
    }

    function cityFromTimeZone(timeZone) {
      return (timeZone.split("/").pop() || "Local time").replace(/_/g, " ");
    }

    function formatDate(parts) {
      return parts.weekday + ", " + Number(parts.day) + " " + parts.month + " " + parts.year;
    }

    function formatZone(value) {
      return (value || "GMT").replace("UTC", "GMT").replace("GMT+0", "GMT");
    }

    function editorIsOpen(parts) {
      const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      const minutes = Number(parts.hour) * 60 + Number(parts.minute);
      return weekdays.includes(parts.weekday) && minutes >= 540 && minutes < 1140;
    }

    function differenceText(date) {
      const difference = zoneOffsetMinutes(date, clientZone) - zoneOffsetMinutes(date, EDITOR_ZONE);
      if (difference === 0) return "Same local time as the editor";
      const absolute = Math.abs(difference);
      const hours = Math.floor(absolute / 60);
      const minutes = absolute % 60;
      const pieces = [];
      if (hours) pieces.push(hours + " " + (hours === 1 ? "hour" : "hours"));
      if (minutes) pieces.push(minutes + " " + (minutes === 1 ? "minute" : "minutes"));
      return pieces.join(" ") + " " + (difference > 0 ? "ahead of" : "behind") + " the editor";
    }

    function updateClocks() {
      const now = new Date();
      const editor = partsFor(now, EDITOR_ZONE);
      const local = partsFor(now, clientZone);
      const open = editorIsOpen(editor);
      const setText = (selector, value) => {
        const node = document.querySelector(selector);
        if (node) node.textContent = value;
      };
      setText("[data-editor-time]", editor.hour + ":" + editor.minute);
      setText("[data-editor-seconds]", ":" + editor.second);
      setText("[data-editor-zone]", formatZone(editor.timeZoneName));
      setText("[data-editor-date]", formatDate(editor));
      setText("[data-editor-status-text]", open ? "Open now" : "After hours");
      setText("[data-local-city]", cityFromTimeZone(clientZone));
      setText("[data-local-time]", local.hour + ":" + local.minute);
      setText("[data-local-seconds]", ":" + local.second);
      setText("[data-local-zone]", formatZone(local.timeZoneName));
      setText("[data-local-date]", formatDate(local));
      setText("[data-time-difference]", differenceText(now));
      setText("[data-reply-note]", open
        ? "You are within the editor's usual working hours (Mon-Fri, 09:00-19:00 Dublin time)."
        : "You are outside the editor's usual working hours. Your request will be reviewed within 24 hours.");
    }

    function updateSubmitState() {
      submit.disabled = paymentPending || !(consent.checked && paymentAck.checked);
    }

    function setUploadState(state, title, message) {
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

    function saveRememberedDetails() {
      const remember = $('input[name="remember_details"]');
      if (!remember || !window.localStorage) return;
      if (!remember.checked) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        name: $('input[name="client_name"]').value,
        email: $('input[name="client_email"]').value
      }));
    }

    function restoreRememberedDetails() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
        if (!saved) return;
        $('input[name="client_name"]').value = saved.name || "";
        $('input[name="client_email"]').value = saved.email || "";
      } catch (error) {
        console.warn("Remembered proofreading details could not be restored.", error);
      }
    }

    function localTimeText() {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date());
    }

    function requestedTurnaround() {
      if (!deadlineUtcInput.value) return "Not specified";
      const milliseconds = new Date(deadlineUtcInput.value).getTime() - Date.now();
      if (milliseconds <= 0) return "Deadline has passed";
      const hours = Math.ceil(milliseconds / 3600000);
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (!days) return hours + " " + (hours === 1 ? "hour" : "hours");
      return days + " " + (days === 1 ? "day" : "days") +
        (remainingHours ? ", " + remainingHours + " " + (remainingHours === 1 ? "hour" : "hours") : "");
    }

    function addReviewRow(label, value, total) {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      if (total) {
        term.dataset.total = "";
        description.dataset.total = "";
      }
      reviewList.append(term, description);
    }

    function closeReview() {
      modal.hidden = true;
    }

    function showReview() {
      reviewList.replaceChildren();
      const responseNote = document.querySelector("[data-reply-note]");
      addReviewRow("Editing package", serviceLevelInput.value || "Premium");
      addReviewRow("Document", fileInput.files[0] ? fileInput.files[0].name : "Pasted text");
      addReviewRow("Document word count", wordCountInput.value || "0");
      addReviewRow("Maximum word count", $("#fbWordCountLimit").value || "No limit specified");
      addReviewRow("English preference", englishPreferenceInput.value || "No preference selected");
      addReviewRow("Name", $('input[name="client_name"]').value.trim());
      addReviewRow("Email", $('input[name="client_email"]').value.trim());
      addReviewRow("Editing instructions", $('textarea[name="additional_editing_instructions"]').value.trim() || "None provided");
      addReviewRow("Your local time", localTimeText());
      addReviewRow("Tutor time", document.querySelector("[data-editor-time]").textContent + " " + document.querySelector("[data-editor-zone]").textContent);
      addReviewRow("Expected response", responseNote ? responseNote.textContent : "Within 24 hours");
      addReviewRow("Requested turnaround", requestedTurnaround());
      addReviewRow("Completion deadline", deadlineDublinInput.value + " (Dublin)");
      addReviewRow("Estimated total", costInput.value || "€0.00", true);
      modal.hidden = false;
      editButton.focus();
    }

    function validateBeforeReview() {
      updateEstimate();
      updateEnglishPreference();
      if (!form.reportValidity()) return false;
      if (!text.value.trim() && !fileInput.files.length) {
        window.alert("Please paste your text or upload a document before continuing.");
        text.focus();
        return false;
      }
      if (!updateDeadline()) {
        window.alert("Please choose both a completion date and time.");
        const visibleDate = form.querySelector('#fbDeadlineDate + input') || dateInput;
        visibleDate.focus();
        return false;
      }
      if (!englishPreferenceInput.value) {
        window.alert("Please select at least one English preference.");
        return false;
      }
      saveRememberedDetails();
      return true;
    }

    async function createPaymentPage() {
      if (paymentPending) return;
      if (!validateBeforeReview()) {
        closeReview();
        return;
      }
      paymentPending = true;
      updateSubmitState();
      payButton.disabled = true;
      payButton.textContent = "Creating payment...";
      submit.textContent = "Creating payment...";

      try {
        const formData = new FormData(form);
        formData.set("pasted_text", useUploadedDocumentText ? uploadedDocumentText : text.value);
        formData.set("word_count", wordCountInput.value);
        formData.set("calculated_price", costInput.value);
        formData.set("service_level", serviceLevelInput.value);
        formData.set("english_preference", englishPreferenceInput.value);
        formData.set("word_count_limit", $("#fbWordCountLimit").value.trim());
        formData.set("additional_editing_instructions", $('textarea[name="additional_editing_instructions"]').value.trim());
        formData.set("deadline", deadlineInput.value);
        formData.set("deadline_timezone", deadlineTimezoneInput.value);
        formData.set("deadline_utc", deadlineUtcInput.value);
        formData.set("deadline_dublin_local", deadlineDublinInput.value);
        formData.set("submission_date", new Date().toISOString());
        formData.set("request_status", "New");
        formData.set("success_url", PAYMENT_SUCCESS_URL);

        const response = await fetch(WEBHOOK_URL, { method: "POST", body: formData });
        let result;
        try {
          result = await response.json();
        } catch (error) {
          throw new Error("Make did not return JSON.");
        }
        if (!response.ok || !result.success || !result.checkout_url) {
          throw new Error(result.error || "Payment link was not created.");
        }
        payButton.textContent = "Redirecting to Stripe...";
        submit.textContent = "Redirecting to Stripe...";
        window.location.assign(result.checkout_url);
      } catch (error) {
        console.error(error);
        window.alert("Something went wrong while creating the payment page. Please try again.");
        paymentPending = false;
        payButton.disabled = false;
        payButton.textContent = "Continue to Stripe →";
        submit.textContent = "Review request →";
        updateSubmitState();
      }
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

    $$('[data-english-preference]').forEach((checkbox) => {
      checkbox.addEventListener("change", updateEnglishPreference);
    });

    text.addEventListener("input", () => {
      if (useUploadedDocumentText) {
        useUploadedDocumentText = false;
        uploadedDocumentText = "";
      }
      updateEstimate();
    });
    text.addEventListener("paste", () => window.setTimeout(updateEstimate, 0));
    consent.addEventListener("change", updateSubmitState);
    paymentAck.addEventListener("change", updateSubmitState);

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) {
        uploadedDocumentText = "";
        useUploadedDocumentText = false;
        uploadLabel.textContent = "Drop a document here, or click to upload";
        setUploadState("", "Ready for a document", "Upload a DOCX, text-based PDF, or TXT file to calculate the word count.");
        return;
      }

      uploadLabel.textContent = file.name;
      setUploadState("reading", "Reading document...", "Extracting text from " + file.name + ". This usually takes a few seconds.");
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
        setUploadState("success", "Document ready", file.name + " was read successfully. Word count: " + wordCountInput.value + ". Estimate: " + costInput.value + ".");
      } catch (error) {
        console.error(error);
        uploadedDocumentText = "";
        useUploadedDocumentText = false;
        uploadLabel.textContent = "Could not read document";
        setUploadState("error", "Document could not be read", "Please upload a DOCX, text-based PDF, or TXT file. Scanned PDFs are not supported.");
        window.alert("This document could not be read. Please upload a DOCX, text-based PDF, or TXT file.");
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (validateBeforeReview()) showReview();
    });
    editButton.addEventListener("click", closeReview);
    closeButton.addEventListener("click", closeReview);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeReview();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeReview();
    });
    payButton.addEventListener("click", createPaymentPage);

    restoreRememberedDetails();
    initializePickers();
    updateEnglishPreference();
    updateEstimate();
    updateDeadline();
    updateSubmitState();
    updateClocks();
    window.setInterval(updateClocks, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

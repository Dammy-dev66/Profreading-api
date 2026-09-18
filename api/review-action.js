const MAKE_ACTION_URL = "https://hook.eu1.make.com/ygxwsyhwa5w5vid8nfqfjocx14zhjnia";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action https://hook.eu1.make.com; base-uri 'none'; frame-ancestors 'none'");
  res.end(html);
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendHtml(res, 405, "<h1>Method not allowed</h1>");
  }

  const submissionId = String(req.query.submission_id || "").trim();
  const token = String(req.query.token || "").trim();
  const action = String(req.query.action || "").trim().toLowerCase();

  if (!submissionId || !token || !["accept", "refuse"].includes(action)) {
    return sendHtml(res, 400, "<h1>Invalid review link</h1><p>This request cannot be processed from an incomplete link.</p>");
  }

  const accepting = action === "accept";
  const title = accepting ? "Accept this proofreading request?" : "Refuse this proofreading request?";
  const explanation = accepting
    ? "Confirming will capture the authorised Stripe payment and notify the customer that editing has started."
    : "Confirming will cancel the Stripe payment authorisation and notify the customer that the request was declined.";
  const buttonLabel = accepting ? "Accept and capture payment" : "Refuse and release hold";
  const buttonColor = accepting ? "#0A3D91" : "#8A1F1F";

  return sendHtml(res, 200, `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f1ea;color:#181c20;font-family:Arial,Helvetica,sans-serif;padding:48px 20px;">
  <main style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #d8d1c4;padding:32px;">
    <img src="https://profreading-api.vercel.app/assets/finbar-horizontal-logo.png" alt="Finbar B. Elite Tutoring" width="220" style="display:block;max-width:100%;height:auto;margin:0 0 28px;">
    <p style="margin:0 0 8px;color:#DDA31D;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Final confirmation</p>
    <h1 style="margin:0 0 14px;color:#0A3D91;font:400 28px/1.2 Georgia,serif;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.65;">${escapeHtml(explanation)}</p>
    <p style="margin:0 0 26px;color:#6b7280;font-size:12px;">Reference: ${escapeHtml(submissionId)}</p>
    <form method="post" action="${MAKE_ACTION_URL}">
      <input type="hidden" name="submission_id" value="${escapeHtml(submissionId)}">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <input type="hidden" name="action" value="${escapeHtml(action)}">
      <button type="submit" style="min-height:48px;border:0;background:${buttonColor};color:#fffdf8;padding:0 20px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;">${escapeHtml(buttonLabel)}</button>
    </form>
    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">No payment action occurs unless you press the confirmation button above.</p>
  </main>
</body>
</html>`);
}

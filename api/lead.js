// Vercel Serverless Function — принимает заявку с формы и создаёт лид в Bitrix24.
// Секретный вебхук Bitrix никогда не попадает в браузер и не хранится в репозитории —
// он читается из переменной окружения BITRIX_WEBHOOK_URL (задаётся в Vercel Dashboard →
// Project → Settings → Environment Variables).

const PHONE_RE = /^[\s+()\d-]{5,20}$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) {
    console.error("BITRIX_WEBHOOK_URL is not set");
    return res.status(500).json({ ok: false, error: "server_not_configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  const consent = Boolean(body.consent);

  if (!name || !contact || !consent) {
    return res.status(400).json({ ok: false, error: "validation_failed" });
  }

  const need = String(body.need || "").trim();
  const qty = String(body.qty || "").trim();
  const comment = String(body.comment || "").trim();
  const source = String(body.source || "").trim();
  const utmSource = String(body.utm_source || "").trim();
  const utmMedium = String(body.utm_medium || "").trim();
  const utmCampaign = String(body.utm_campaign || "").trim();
  const utmContent = String(body.utm_content || "").trim();
  const utmTerm = String(body.utm_term || "").trim();

  const commentLines = [
    "Заявка с лендинга распродажи Studio PNHD (sale-pnhd.vercel.app)",
    `Контакт (как указал посетитель): ${contact}`,
    need ? `Что нужно: ${need}` : null,
    qty ? `Примерное количество: ${qty}` : null,
    comment ? `Комментарий: ${comment}` : null,
    source ? `Источник перехода: ${source}` : null,
  ].filter(Boolean).join("\n");

  const fields = {
    TITLE: `Заявка с распродажи PNHD — ${name}`,
    NAME: name,
    COMMENTS: commentLines,
    UTM_SOURCE: utmSource || undefined,
    UTM_MEDIUM: utmMedium || undefined,
    UTM_CAMPAIGN: utmCampaign || undefined,
    UTM_CONTENT: utmContent || undefined,
    UTM_TERM: utmTerm || undefined,
  };

  if (PHONE_RE.test(contact)) {
    fields.PHONE = [{ VALUE: contact, VALUE_TYPE: "WORK" }];
  }

  const url = webhook.replace(/\/+$/, "") + "/crm.lead.add.json";

  try {
    const bitrixRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields, params: { REGISTER_SONET_EVENT: "Y" } }),
    });
    const data = await bitrixRes.json();

    if (!bitrixRes.ok || data.error) {
      console.error("Bitrix error:", data);
      return res.status(502).json({ ok: false, error: "bitrix_error" });
    }

    return res.status(200).json({ ok: true, leadId: data.result });
  } catch (err) {
    console.error("Bitrix request failed:", err);
    return res.status(502).json({ ok: false, error: "bitrix_unreachable" });
  }
};

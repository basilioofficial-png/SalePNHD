(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * Аналитика: sale_route_click, sale_calendar_click, sale_contact_click,
   * sale_customization_click, sale_form_start, sale_form_submit,
   * sale_scroll_50, sale_scroll_90.
   * Пушим в dataLayer (GA4/GTM) и, если подключена, в Яндекс.Метрику.
   * ------------------------------------------------------------------ */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
    if (typeof window.ym === "function" && window.YM_COUNTER_ID) {
      window.ym(window.YM_COUNTER_ID, "reachGoal", event, params || {});
    }
  }

  document.querySelectorAll("[data-analytics]").forEach(function (el) {
    el.addEventListener("click", function () {
      track(el.getAttribute("data-analytics"));
    });
  });

  var scrolled50 = false, scrolled90 = false;
  window.addEventListener("scroll", function () {
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop;
    var height = (doc.scrollHeight - doc.clientHeight) || 1;
    var pct = (scrollTop / height) * 100;
    if (!scrolled50 && pct >= 50) { scrolled50 = true; track("sale_scroll_50"); }
    if (!scrolled90 && pct >= 90) { scrolled90 = true; track("sale_scroll_90"); }
  }, { passive: true });

  /* ------------------------------------------------------------------
   * UTM-метки и источник — сохраняем при заходе и подставляем в форму
   * ------------------------------------------------------------------ */
  (function captureUtm() {
    var params = new URLSearchParams(window.location.search);
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem("pnhd_utm") || "{}"); } catch (e) {}
    var changed = false;
    keys.forEach(function (k) {
      var v = params.get(k);
      if (v) { stored[k] = v; changed = true; }
    });
    if (!stored.source) {
      stored.source = document.referrer || "direct";
      changed = true;
    }
    if (changed) {
      try { sessionStorage.setItem("pnhd_utm", JSON.stringify(stored)); } catch (e) {}
    }
    keys.forEach(function (k) {
      var input = document.getElementById("f-" + k.replace("utm_", "utm-"));
      if (input) input.value = stored[k] || "";
    });
    var srcInput = document.getElementById("f-source");
    if (srcInput) srcInput.value = stored.source || "";
  })();

  /* ------------------------------------------------------------------
   * Мобильное меню
   * ------------------------------------------------------------------ */
  var menuToggle = document.getElementById("menuToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = document.body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ------------------------------------------------------------------
   * FAQ-аккордеон
   * ------------------------------------------------------------------ */
  document.querySelectorAll(".faq-item__q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      var isOpen = item.classList.contains("is-open");
      document.querySelectorAll(".faq-item.is-open").forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove("is-open");
          openItem.querySelector(".faq-item__q").setAttribute("aria-expanded", "false");
          openItem.querySelector(".faq-item__sign").textContent = "+";
        }
      });
      item.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
      item.querySelector(".faq-item__sign").textContent = !isOpen ? "–" : "+";
    });
  });

  /* ------------------------------------------------------------------
   * Форма заявки: валидация + локальное состояние успеха.
   *
   * ВАЖНО: сейчас форма не отправляется никуда — это ТОЛЬКО фронтенд.
   * Чтобы реально получать заявки, подключите приём данных (см. README,
   * раздел «Форма заявки»): например, Vercel Serverless Function,
   * который отправляет данные в вашу CRM/почту/Telegram, или сторонний
   * сервис форм (Getform, Formspree и т.п.).
   * ------------------------------------------------------------------ */
  var form = document.getElementById("saleForm");
  var formCard = document.getElementById("formCard");
  var formReset = document.getElementById("formReset");
  var startedTracking = false;

  function setError(fieldId, message) {
    var el = document.getElementById("err-" + fieldId);
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  if (form) {
    form.addEventListener("input", function () {
      if (!startedTracking) {
        startedTracking = true;
        track("sale_form_start");
      }
    }, { once: false });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var contact = form.contact.value.trim();
      var consent = form.consent.checked;
      var hasError = false;

      if (!name) { setError("name", "Укажите имя"); hasError = true; } else { setError("name", null); }
      if (!contact) { setError("contact", "Укажите телефон или Telegram"); hasError = true; } else { setError("contact", null); }
      if (!consent) { setError("consent", "Нужно согласие на обработку данных"); hasError = true; } else { setError("consent", null); }

      if (hasError) return;

      /* TODO: здесь должен быть реальный запрос на бэкенд/CRM, например:
       * fetch("/api/lead", { method: "POST", body: new FormData(form) })
       */

      track("sale_form_submit", {
        need: form.need.value,
        qty: form.qty.value
      });

      formCard.classList.add("is-sent");
      form.classList.add("is-sent");
    });
  }

  if (formReset) {
    formReset.addEventListener("click", function () {
      form.reset();
      formCard.classList.remove("is-sent");
      form.classList.remove("is-sent");
      startedTracking = false;
      setError("name", null);
      setError("contact", null);
      setError("consent", null);
    });
  }

  /* ------------------------------------------------------------------
   * «Добавить в календарь» — генерируем .ics на лету, отдельно на
   * 19 и на 20 сентября (два разных события, а не одно на 33 часа).
   * ------------------------------------------------------------------ */
  function buildIcs(dateStr, title) {
    // dateStr: "2026-09-19" — событие 11:00–20:00 по Москве (UTC+3)
    var dtStart = dateStr.replace(/-/g, "") + "T080000Z"; // 11:00 MSK
    var dtEnd = dateStr.replace(/-/g, "") + "T170000Z";   // 20:00 MSK
    var now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Studio PNHD//Sale Landing//RU",
      "BEGIN:VEVENT",
      "UID:pnhd-sale-" + dateStr + "@studio.pnhd.ru",
      "DTSTAMP:" + now,
      "DTSTART:" + dtStart,
      "DTEND:" + dtEnd,
      "SUMMARY:" + title,
      "LOCATION:Санкт-Петербург\\, ул. Чапыгина\\, 1 (Studio PNHD)",
      "DESCRIPTION:Большая распродажа трикотажа PNHD",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
  }

  document.querySelectorAll(".js-add-calendar").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var date = btn.getAttribute("data-date");
      var ics = buildIcs(date, "Распродажа трикотажа PNHD");
      var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "pnhd-sale-" + date + ".ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  /* ------------------------------------------------------------------
   * Режим «мероприятие завершено».
   * После окончания распродажи (20 сентября 2026, 20:00 по Москве)
   * страница сама переключается: даты скрываются как активный оффер,
   * кнопка маршрута остаётся только в контактах, финальный CTA меняет
   * заголовок, а вверху появляется баннер.
   * ------------------------------------------------------------------ */
  var SALE_END_ISO = "2026-09-20T20:00:00+03:00";
  if (new Date() > new Date(SALE_END_ISO)) {
    document.body.setAttribute("data-sale-ended", "true");
    document.querySelectorAll(".js-cta-main").forEach(function (btn) {
      btn.textContent = "Заказать трикотаж и нанесение";
    });
    var endedTitle = document.querySelector("[data-sale-ended-title]");
    var endedLede = document.querySelector("[data-sale-ended-lede]");
    if (endedTitle) endedTitle.style.display = "";
    if (endedLede) endedLede.style.display = "";
  }
})();

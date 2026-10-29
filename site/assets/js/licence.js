const strings = {
  it: { help:"Aiuto", privacy:"Privacy", title:"Licenza e utilizzo", updated:"Ultimo aggiornamento", date:"10 ottobre 2026", back:"Torna alla home page", pageTitle:"Licenza e utilizzo · Home Page di Lirux" },
  en: { help:"Help", privacy:"Privacy", title:"Licence and use", updated:"Last updated", date:"10 October 2026", back:"Back to the home page", pageTitle:"Licence and use · Lirux's Home Page" }
};

function applyLanguage(lang) {
  document.documentElement.lang = lang;
  document.title = strings[lang].pageTitle;
  document.querySelector("#licence-help").href = lang === "en" ? "/help.html?lang=en" : "/help.html";
  document.querySelector("#licence-privacy").href = lang === "en" ? "/privacy.html?lang=en" : "/privacy.html";
  document.querySelector("[data-t=back]").href = lang === "en" ? "/?lang=en" : "/";

  document.querySelectorAll("[data-t]").forEach(el => {
    el.textContent = strings[lang][el.dataset.t];
  });

  document.querySelectorAll("[data-section]").forEach(el => {
    el.hidden = el.dataset.section !== lang;
  });

  document.querySelectorAll(".lang button").forEach(el => {
    el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
  });
}

document.querySelectorAll(".lang button").forEach(el => {
  el.addEventListener("click", () => {
    const lang = el.dataset.lang;

    const url = new URL(window.location.href);
    if (lang === "en") {
      url.searchParams.set("lang", "en");
    } else {
      url.searchParams.delete("lang");
    }
    window.history.replaceState(null, "", url);

    applyLanguage(lang);
  });
});

applyLanguage(
  new URLSearchParams(window.location.search).get("lang") === "en" ||
  (!window.location.search.includes("lang") && (navigator.language || "").slice(0,2) !== "it")
    ? "en"
    : "it"
);

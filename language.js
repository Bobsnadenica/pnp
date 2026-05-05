(function () {
  const STORAGE_KEY = "malkokote:language";
  const SUPPORTED_LANGUAGES = ["en", "bg", "ja", "fr", "de", "tr"];

  const FLAGS = {
    en: "🇬🇧",
    bg: "🇧🇬",
    ja: "🇯🇵",
    fr: "🇫🇷",
    de: "🇩🇪",
    tr: "🇹🇷"
  };

  const TRANSLATIONS = {
    en: {
      gallery: "Gallery",
      contact: "Contact",
      buy: "Buy",
      login: "Login",
      logout: "Logout",
      adultsOnly: "Adults only",
      ageGateCopy: "This website contains adult modeling and photography content. Enter only if you are 18 or older.",
      enter: "Enter",
      leave: "Leave",
      loadMore: "Load more",
      loading: "Loading...",
      continue: "Continue",
      redirecting: "Redirecting...",
      accountRequest: "If you want an account, use",
      dayThinking: "Look what she does at night",
      nightThinking: "She's not that type of girl",
      refresh: "Refresh",
      signOut: "Sign Out",
      returnHome: "Return to Malkokote",
      noMedia: "No media.",
      unableToLoad: "Unable to load.",
      loadingNight: "Loading night gallery.",
      loadingDay: "Loading day gallery.",
      unableToLoadGallery: "Unable to load gallery.",
      humanCheck: "Human check",
      solveToContinue: "Solve the check to continue.",
      checkComplete: "Human check complete."
    },
    bg: {
      gallery: "Галерия",
      contact: "Контакт",
      buy: "Купи",
      login: "Вход",
      logout: "Изход",
      adultsOnly: "Само за възрастни",
      ageGateCopy: "Този сайт съдържа 18+ моделни и фотографски материали. Влезте само ако сте навършили 18 години.",
      enter: "Влез",
      leave: "Излез",
      loadMore: "Зареди още",
      loading: "Зареждане...",
      continue: "Продължи",
      redirecting: "Пренасочване...",
      accountRequest: "Ако искате профил, използвайте",
      dayThinking: "Виж какво прави през нощта",
      nightThinking: "Тя не е такова момиче",
      refresh: "Обнови",
      signOut: "Изход",
      returnHome: "Върни се в Malkokote",
      noMedia: "Няма медия.",
      unableToLoad: "Неуспешно зареждане.",
      loadingNight: "Зареждане на нощната галерия.",
      loadingDay: "Зареждане на дневната галерия.",
      unableToLoadGallery: "Неуспешно зареждане на галерията.",
      humanCheck: "Проверка",
      solveToContinue: "Решете задачата, за да продължите.",
      checkComplete: "Проверката е завършена."
    },
    ja: {
      gallery: "ギャラリー",
      contact: "お問い合わせ",
      buy: "購入",
      login: "ログイン",
      logout: "ログアウト",
      adultsOnly: "18歳以上限定",
      ageGateCopy: "このウェブサイトには成人向けモデルおよび写真コンテンツが含まれています。18歳以上の方のみご入場いただけます。",
      enter: "入る",
      leave: "離れる",
      loadMore: "もっと読み込む",
      loading: "読み込み中...",
      continue: "続行",
      redirecting: "リダイレクト中...",
      accountRequest: "アカウントが必要な場合は",
      dayThinking: "彼女が夜に何をしているか見てみましょう",
      nightThinking: "彼女はそういうタイプの子ではありません",
      refresh: "更新",
      signOut: "ログアウト",
      returnHome: "Malkokoteに戻る",
      noMedia: "メディアがありません。",
      unableToLoad: "読み込めません。",
      loadingNight: "夜のギャラリーを読み込み中。",
      loadingDay: "昼のギャラリーを読み込み中。",
      unableToLoadGallery: "ギャラリーを読み込めません。",
      humanCheck: "本人確認",
      solveToContinue: "続行するにはチェックを解いてください。",
      checkComplete: "本人確認が完了しました。"
    },
    fr: {
      gallery: "Galerie",
      contact: "Contact",
      buy: "Acheter",
      login: "Connexion",
      logout: "Déconnexion",
      adultsOnly: "Adultes seulement",
      ageGateCopy: "Ce site contient du contenu de mannequinat et de photographie pour adultes. Entrez uniquement si vous avez 18 ans ou plus.",
      enter: "Entrer",
      leave: "Quitter",
      loadMore: "Charger plus",
      loading: "Chargement...",
      continue: "Continuer",
      redirecting: "Redirection...",
      accountRequest: "Si vous voulez un compte, utilisez",
      dayThinking: "Regardez ce qu'elle fait la nuit",
      nightThinking: "Ce n'est pas ce genre de fille",
      refresh: "Rafraîchir",
      signOut: "Déconnexion",
      returnHome: "Retour à Malkokote",
      noMedia: "Aucun média.",
      unableToLoad: "Impossible de charger.",
      loadingNight: "Chargement de la galerie de nuit.",
      loadingDay: "Chargement de la galerie de jour.",
      unableToLoadGallery: "Impossible de charger la galerie.",
      humanCheck: "Vérification humaine",
      solveToContinue: "Résolvez le test pour continuer.",
      checkComplete: "Vérification humaine terminée."
    },
    de: {
      gallery: "Galerie",
      contact: "Kontakt",
      buy: "Kaufen",
      login: "Anmelden",
      logout: "Abmelden",
      adultsOnly: "Nur für Erwachsene",
      ageGateCopy: "Diese Website enthält Modell- und Fotografieinhalte für Erwachsene. Betreten erst ab 18 Jahren.",
      enter: "Betreten",
      leave: "Verlassen",
      loadMore: "Mehr laden",
      loading: "Laden...",
      continue: "Weiter",
      redirecting: "Weiterleitung...",
      accountRequest: "Wenn Sie ein Konto wünschen, nutzen Sie",
      dayThinking: "Schau, was sie nachts macht",
      nightThinking: "Sie ist nicht dieser Typ Mädchen",
      refresh: "Aktualisieren",
      signOut: "Abmelden",
      returnHome: "Zurück zu Malkokote",
      noMedia: "Keine Medien.",
      unableToLoad: "Laden nicht möglich.",
      loadingNight: "Nachtgalerie wird geladen.",
      loadingDay: "Tagesgalerie wird geladen.",
      unableToLoadGallery: "Galerie kann nicht geladen werden.",
      humanCheck: "Menschliche Überprüfung",
      solveToContinue: "Lösen Sie die Aufgabe, um fortzufahren.",
      checkComplete: "Überprüfung abgeschlossen."
    },
    tr: {
      gallery: "Galeri",
      contact: "İletişim",
      buy: "Satın Al",
      login: "Giriş Yap",
      logout: "Çıkış Yap",
      adultsOnly: "Sadece Yetişkinler",
      ageGateCopy: "Bu web sitesi yetişkinlere yönelik modellik ve fotoğrafçılık içeriği barındırmaktadır. Sadece 18 yaş ve üzeri iseniz giriş yapınız.",
      enter: "Giriş",
      leave: "Ayrıl",
      loadMore: "Daha fazla yükle",
      loading: "Devam ediyor...",
      continue: "Devam Et",
      redirecting: "Yönlendiriliyor...",
      accountRequest: "Hesap istiyorsanız şunu kullanın",
      dayThinking: "Gece ne yaptığını gör",
      nightThinking: "O öyle bir kız değil",
      refresh: "Yenile",
      signOut: "Çıkış Yap",
      returnHome: "Malkokote'ye Dön",
      noMedia: "Medya yok.",
      unableToLoad: "Yüklenemiyor.",
      loadingNight: "Gece galerisi yükleniyor.",
      loadingDay: "Gündüz galerisi yükleniyor.",
      unableToLoadGallery: "Galeri yüklenemiyor.",
      humanCheck: "Doğrulama",
      solveToContinue: "Devam etmek için doğrulamayı çözün.",
      checkComplete: "Doğrulama tamamlandı."
    }
  };

  function getInitialLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED_LANGUAGES.includes(stored)) {
        return stored;
      }
    } catch {}

    const browserLang = String(navigator.language || "").toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : "en";
  }

  function applyLanguage(language) {
    const dropdownItems = document.querySelectorAll("[data-language-option]");
    const currentFlag = document.querySelector("[data-current-language-flag]");
    const panels = document.querySelectorAll("[data-language-panel]");
    const translatables = document.querySelectorAll("[data-i18n-en], [data-i18n]");

    dropdownItems.forEach((item) => {
      const isActive = item.dataset.languageOption === language;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    if (currentFlag) {
      currentFlag.textContent = FLAGS[language] || "🇬🇧";
    }

    panels.forEach((panel) => {
      const isVisible = panel.dataset.languagePanel === language;
      panel.hidden = !isVisible;
      if (panel.tagName === "SPAN" || panel.tagName === "DIV" || panel.tagName === "A" || panel.tagName === "SECTION") {
          panel.style.display = isVisible ? "" : "none";
      }
    });

    translatables.forEach((el) => {
      const key = el.dataset.i18n;
      let text = key ? TRANSLATIONS[language]?.[key] : el.getAttribute(`data-i18n-${language}`);
      
      if (text) {
        if (el.dataset.profileLabel !== undefined || el.querySelector("[data-profile-label]")) {
           const label = el.querySelector("[data-profile-label]") || el;
           label.textContent = text;
        } else {
           el.textContent = text;
        }
      }
      
      // Update data attributes for script.js to pick up
      const signedOut = el.getAttribute(`data-${language}-signed-out`);
      const signedIn = el.getAttribute(`data-${language}-signed-in`);
      if (signedOut) el.dataset.signedOutText = signedOut;
      if (signedIn) el.dataset.signedInText = signedIn;

      // Update placeholders
      const idleText = el.getAttribute(`data-idle-${language}`) || el.getAttribute(`data-idle-text`);
      const loadingText = el.getAttribute(`data-loading-${language}`) || el.getAttribute(`data-loading-text`);
      if (idleText) el.dataset.idleText = idleText;
      if (loadingText) el.dataset.loadingText = loadingText;
    });

    document.documentElement.lang = language;

    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}

    window.dispatchEvent(new CustomEvent("malkokote:languagechange", { detail: { language } }));
  }

  function init() {
    const toggle = document.querySelector("[data-language-toggle]");
    const menu = document.querySelector(".language-menu");
    const options = document.querySelectorAll("[data-language-option]");
    
    if (toggle && menu) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("is-active");
        menu.hidden = !menu.classList.contains("is-active");
      });

      document.addEventListener("click", () => {
        menu.classList.remove("is-active");
        menu.hidden = true;
      });
    }

    options.forEach((option) => {
      option.addEventListener("click", () => {
        applyLanguage(option.dataset.languageOption || "en");
      });
    });

    applyLanguage(getInitialLanguage());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MalkokoteLanguage = {
    getLanguage: () => getInitialLanguage(),
    applyLanguage,
    translate: (key) => TRANSLATIONS[getInitialLanguage()]?.[key] || key
  };
})();

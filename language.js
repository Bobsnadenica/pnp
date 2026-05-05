(function () {
  const STORAGE_KEY = "malkokote:language";
  const SUPPORTED_LANGUAGES = ["en", "bg", "ja", "fr", "de", "tr", "ru", "es", "it", "pt", "zh", "ko", "ar"];

  const FLAGS = {
    en: "🇬🇧",
    bg: "🇧🇬",
    ja: "🇯🇵",
    fr: "🇫🇷",
    de: "🇩🇪",
    tr: "🇹🇷",
    ru: "🇷🇺",
    es: "🇪🇸",
    it: "🇮🇹",
    pt: "🇵🇹",
    zh: "🇨🇳",
    ko: "🇰🇷",
    ar: "🇸🇦"
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
    },
    ru: {
      gallery: "Галерея",
      contact: "Контакт",
      buy: "Купить",
      login: "Вход",
      logout: "Выход",
      adultsOnly: "Только для взрослых",
      ageGateCopy: "Этот сайт содержит контент для взрослых. Входите только если вам есть 18 лет.",
      enter: "Войти",
      leave: "Выйти",
      loadMore: "Загрузить еще",
      loading: "Загрузка...",
      continue: "Продолжить",
      redirecting: "Перенаправление...",
      accountRequest: "Если вам нужен аккаунт, используйте",
      dayThinking: "Посмотрите, что она делает ночью",
      nightThinking: "Она не такая девушка",
      refresh: "Обновить",
      signOut: "Выйти",
      returnHome: "Вернуться на Malkokote",
      noMedia: "Медиафайлы отсутствуют.",
      unableToLoad: "Не удалось загрузить.",
      loadingNight: "Загрузка ночной галереи.",
      loadingDay: "Загрузка дневной галереи.",
      unableToLoadGallery: "Не удалось загрузить галерею.",
      humanCheck: "Проверка",
      solveToContinue: "Решите задачу, чтобы продолжить.",
      checkComplete: "Проверка пройдена."
    },
    es: {
      gallery: "Galería",
      contact: "Contacto",
      buy: "Comprar",
      login: "Iniciar sesión",
      logout: "Cerrar sesión",
      adultsOnly: "Solo adultos",
      ageGateCopy: "Este sitio web contiene contenido de modelaje y fotografía para adultos. Ingresa solo si eres mayor de 18 años.",
      enter: "Entrar",
      leave: "Salir",
      loadMore: "Cargar más",
      loading: "Cargando...",
      continue: "Continuar",
      redirecting: "Redirigiendo...",
      accountRequest: "Si quieres una cuenta, usa",
      dayThinking: "Mira lo que hace de noche",
      nightThinking: "Ella no es ese tipo de chica",
      refresh: "Refrescar",
      signOut: "Cerrar sesión",
      returnHome: "Volver a Malkokote",
      noMedia: "Sin medios.",
      unableToLoad: "No se puede cargar.",
      loadingNight: "Cargando galería nocturna.",
      loadingDay: "Cargando galería diurna.",
      unableToLoadGallery: "No se puede cargar la galería.",
      humanCheck: "Verificación humana",
      solveToContinue: "Resuelve la verificación para continuar.",
      checkComplete: "Verificación humana completada."
    },
    it: {
      gallery: "Galleria",
      contact: "Contatti",
      buy: "Acquista",
      login: "Accedi",
      logout: "Esci",
      adultsOnly: "Solo per adulti",
      ageGateCopy: "Questo sito contiene contenuti di modeling e fotografia per adulti. Entra solo se hai più di 18 anni.",
      enter: "Entra",
      leave: "Esci",
      loadMore: "Carica altro",
      loading: "Caricamento...",
      continue: "Continua",
      redirecting: "Reindirizzamento...",
      accountRequest: "Se vuoi un account, usa",
      dayThinking: "Guarda cosa fa di notte",
      nightThinking: "Non è quel tipo di ragazza",
      refresh: "Aggiorna",
      signOut: "Esci",
      returnHome: "Torna a Malkokote",
      noMedia: "Nessun media.",
      unableToLoad: "Impossibile caricare.",
      loadingNight: "Caricamento galleria notturna.",
      loadingDay: "Caricamento galleria diurna.",
      unableToLoadGallery: "Impossibile caricare la galleria.",
      humanCheck: "Controllo umano",
      solveToContinue: "Risolvi il controllo per continuare.",
      checkComplete: "Controllo umano completato."
    },
    pt: {
      gallery: "Galeria",
      contact: "Contato",
      buy: "Comprar",
      login: "Entrar",
      logout: "Sair",
      adultsOnly: "Apenas adultos",
      ageGateCopy: "Este site contém conteúdo de modelagem e fotografia para adultos. Entre apenas se tiver 18 anos ou mais.",
      enter: "Entrar",
      leave: "Sair",
      loadMore: "Carregar mais",
      loading: "Carregando...",
      continue: "Continuar",
      redirecting: "Redirecionando...",
      accountRequest: "Se você quer uma conta, use",
      dayThinking: "Veja o que ela faz à noite",
      nightThinking: "Ela não é esse tipo de garota",
      refresh: "Atualizar",
      signOut: "Sair",
      returnHome: "Voltar para Malkokote",
      noMedia: "Sem mídia.",
      unableToLoad: "Incapaz de carregar.",
      loadingNight: "Carregando galeria noturna.",
      loadingDay: "Carregando galeria diurna.",
      unableToLoadGallery: "Incapaz de carregar a galeria.",
      humanCheck: "Verificação humana",
      solveToContinue: "Resolva a verificação para continuar.",
      checkComplete: "Verificação humana concluída."
    },
    zh: {
      gallery: "画廊",
      contact: "联系我们",
      buy: "购买",
      login: "登录",
      logout: "登出",
      adultsOnly: "仅限成人",
      ageGateCopy: "本网站包含成人模特和摄影内容。只有年满18岁方可进入。",
      enter: "进入",
      leave: "离开",
      loadMore: "加载更多",
      loading: "加载中...",
      continue: "继续",
      redirecting: "重定向中...",
      accountRequest: "如果您需要账户，请使用",
      dayThinking: "看看她晚上在做什么",
      nightThinking: "她不是那种女孩",
      refresh: "刷新",
      signOut: "登出",
      returnHome: "返回 Malkokote",
      noMedia: "无媒体内容。",
      unableToLoad: "无法加载。",
      loadingNight: "正在加载夜间画廊。",
      loadingDay: "正在加载日间画廊。",
      unableToLoadGallery: "无法加载画廊。",
      humanCheck: "真人验证",
      solveToContinue: "完成验证以继续。",
      checkComplete: "真人验证完成。"
    },
    ko: {
      gallery: "갤러리",
      contact: "문의하기",
      buy: "구매",
      login: "로그인",
      logout: "로그아웃",
      adultsOnly: "성인 전용",
      ageGateCopy: "이 웹사이트는 성인용 모델 및 사진 콘텐츠를 포함하고 있습니다. 18세 이상인 경우에만 입장하십시오.",
      enter: "입장",
      leave: "나가기",
      loadMore: "더 보기",
      loading: "로딩 중...",
      continue: "계속",
      redirecting: "리다이렉트 중...",
      accountRequest: "계정을 원하시면 다음을 사용하세요",
      dayThinking: "그녀가 밤에 무엇을 하는지 보세요",
      nightThinking: "그녀는 그런 여자가 아니에요",
      refresh: "새로고침",
      signOut: "로그아웃",
      returnHome: "Malkokote로 돌아가기",
      noMedia: "미디어가 없습니다.",
      unableToLoad: "로드할 수 없습니다.",
      loadingNight: "야간 갤러리를 로드 중입니다.",
      loadingDay: "주간 갤러리를 로드 중입니다.",
      unableToLoadGallery: "갤러리를 로드할 수 없습니다.",
      humanCheck: "사람 확인",
      solveToContinue: "계속하려면 확인을 해결하세요.",
      checkComplete: "사람 확인 완료."
    },
    ar: {
      gallery: "معرض الصور",
      contact: "اتصل بنا",
      buy: "شراء",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      adultsOnly: "للكبار فقط",
      ageGateCopy: "يحتوي هذا الموقع على محتوى عارضات أزياء وتصوير للبالغين. ادخل فقط إذا كان عمرك 18 عامًا أو أكثر.",
      enter: "دخول",
      leave: "مغادرة",
      loadMore: "تحميل المزيد",
      loading: "جاري التحميل...",
      continue: "استمرار",
      redirecting: "جاري إعادة التوجيه...",
      accountRequest: "إذا كنت تريد حسابًا، استخدم",
      dayThinking: "انظر ماذا تفعل في الليل",
      nightThinking: "ليست من ذلك النوع من الفتيات",
      refresh: "تحديث",
      signOut: "تسجيل الخروج",
      returnHome: "العودة إلى Malkokote",
      noMedia: "لا يوجد وسائط.",
      unableToLoad: "تعذر التحميل.",
      loadingNight: "جاري تحميل معرض الليل.",
      loadingDay: "جاري تحميل معرض النهار.",
      unableToLoadGallery: "تعذر تحميل المعرض.",
      humanCheck: "التحقق البشري",
      solveToContinue: "حل التحقق للاستمرار.",
      checkComplete: "اكتمل التحقق البشري."
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
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

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
        const isActive = menu.classList.toggle("is-active");
        toggle.classList.toggle("is-active", isActive);
        menu.hidden = !isActive;
      });

      document.addEventListener("click", () => {
        menu.classList.remove("is-active");
        toggle.classList.remove("is-active");
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

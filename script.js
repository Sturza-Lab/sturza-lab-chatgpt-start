const STORAGE_KEY = "sturza-lab-chatgpt-start-v1";
const stepNames = ["Страна", "Устройство", "Аккаунт", "Чат", "Голос", "Файлы", "Тариф", "Результат"];
const testPrompt = "Я никогда раньше не работала с ChatGPT. Ответь по-русски, коротко и без технических терминов. Задай мне три вопроса о сайте, который я хочу создать.";

const defaults = {
  route: "supported",
  step: 1,
  platform: null,
  plan: null,
  paymentRoute: null,
  connectionReady: false,
  accountReady: false,
  authRemembered: false,
  historyReady: false,
  chatReady: false,
  voiceReady: false,
  fileReady: false,
  toolsReady: false,
};

let state = { ...defaults };
let recognition = null;
let voiceText = "";
let fileName = "";

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved && typeof saved === "object") state = { ...defaults, ...saved };
} catch (_) {
  // The diagnostic still works if browser storage is disabled.
}

const stepCard = document.getElementById("step-card");
const diagnostic = document.getElementById("diagnostic");

document.querySelectorAll(".sound-wave").forEach((wave) => {
  for (let index = 0; index < 15; index += 1) {
    const line = document.createElement("i");
    line.style.setProperty("--height", `${(index % 7) * 17}px`);
    line.style.setProperty("--delay", `${index * -80}ms`);
    wave.appendChild(line);
  }
});

const heroProgress = document.getElementById("hero-progress");
for (let index = 1; index <= 8; index += 1) {
  const item = document.createElement("span");
  item.textContent = String(index);
  if (index === 1) item.className = "active";
  heroProgress.appendChild(item);
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

function setState(patch) {
  state = { ...state, ...patch };
  save();
}

function updateRouteUI() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    const selected = button.dataset.route === state.route;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.getElementById("route-hint").textContent = state.route === "russia"
    ? "Дадим практический маршрут для России и честно обозначим ограничения."
    : "Маршрут можно изменить в любой момент.";
}

function renderRail() {
  const rail = document.getElementById("rail-steps");
  rail.innerHTML = stepNames.map((name, index) => {
    const step = index + 1;
    const className = step === state.step ? "current" : step < state.step ? "passed" : "";
    return `<button type="button" class="${className}" data-goto="${step}" aria-label="Перейти к шагу ${step}"><span>${step}</span><small>${name}</small></button>`;
  }).join("");
  rail.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => goToStep(Number(button.dataset.goto))));
}

function frame(number, label, title, body) {
  return `
    <div class="step-header"><div><span>${number}</span><small>${label}</small></div><p>STURZA LAB · проверка готовности</p></div>
    <h2>${title}</h2>${body}`;
}

function notice(tone, text) {
  return `<div class="notice ${tone}"><span aria-hidden="true">${tone === "info" ? "i" : "!"}</span><p>${text}</p></div>`;
}

function nav(back, next, disabled = false, nextLabel = "Продолжить") {
  return `<div class="step-navigation">${back ? `<button type="button" class="nav-back" data-back="${back}">← Назад</button>` : "<span></span>"}${next ? `<button type="button" class="nav-next" data-next="${next}" ${disabled ? "disabled" : ""}>${nextLabel} <span aria-hidden="true">→</span></button>` : ""}</div>`;
}

function checkbox(key, label) {
  return `<label><input type="checkbox" data-check="${key}" ${state[key] ? "checked" : ""}><span class="custom-check" aria-hidden="true"></span><strong>${label}</strong></label>`;
}

function bindCommon() {
  stepCard.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => goToStep(Number(button.dataset.back))));
  stepCard.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => goToStep(Number(button.dataset.next))));
  stepCard.querySelectorAll("[data-check]").forEach((input) => input.addEventListener("change", () => {
    setState({ [input.dataset.check]: input.checked });
    renderStep();
  }));
}

function renderStep() {
  renderRail();
  const routeTitles = {
    supported: ["Нахожусь в поддерживаемой стране", "Проверим приложение, голос и доступные функции"],
    russia: ["Сейчас в России", "Настроим доступ, официальное приложение и варианты оплаты"],
    travel: ["Путешествую", "Проверим аккаунт и доступ в текущей стране"],
  };

  if (state.step === 1) {
    const route = routeTitles[state.route];
    stepCard.innerHTML = frame("01", "Страна", "Выберите текущий маршрут", `
      <p class="step-intro">Мы уже сохранили выбор наверху. Сейчас выбран маршрут:</p>
      <div class="selection-summary"><strong>${route[0]}</strong><span>${route[1]}</span></div>
      <div class="step-navigation"><span></span><button type="button" class="nav-next" id="route-next">Продолжить <span>→</span></button></div>`);
    document.getElementById("route-next").addEventListener("click", continueFromRoute);
  }

  if (state.step === 2) {
    const travel = state.route === "travel" ? notice("info", "Если аккаунт раньше использовался в неподдерживаемой стране, после возвращения OpenAI рекомендует очистить кеш и cookies, попробовать приватное окно и другой браузер.") : "";
    const deviceGuide = state.route === "russia" && state.platform === "computer" ? `
      <div class="selection-summary"><strong>Компьютер · пошагово</strong><span>1. Подключитесь к одному серверу выбранной поддерживаемой страны. 2. Откройте приватное окно браузера. 3. Перейдите только на chatgpt.com. 4. Создайте собственный аккаунт или войдите в него. Отдельная установка не нужна.</span></div>`
      : state.route === "russia" && state.platform === "iphone" ? `
      <div class="selection-summary"><strong>iPhone или iPad · пошагово</strong><span>1. Сначала проверьте web-версию на chatgpt.com. 2. Если ChatGPT отсутствует в App Store: Настройки → ваше имя → Медиаматериалы и покупки → Просмотреть → Страна/регион. 3. Apple может потребовать отменить активные подписки, потратить остаток и указать действительный способ оплаты и billing address новой страны. 4. После смены региона найдите «OpenAI ChatGPT» и проверьте, что издатель — OpenAI.</span><a href="https://support.apple.com/en-us/118283" target="_blank" rel="noreferrer">Официальная инструкция Apple ↗</a></div>`
      : state.route === "russia" && state.platform === "android" ? `
      <div class="selection-summary"><strong>Android · пошагово</strong><span>Google разрешает смену страны Play только при нахождении в новой стране и наличии её платёжного способа; повторная смена ограничена сроком. Если этих условий нет, используйте chatgpt.com в браузере и не устанавливайте APK из сторонних источников.</span><a href="https://support.google.com/googleplay/answer/7431675" target="_blank" rel="noreferrer">Правила Google Play ↗</a></div>` : "";
    const russiaGuide = state.route === "russia" ? `
      ${notice("warning", "Россия не входит в официальный список поддерживаемых стран OpenAI. Доступ из неподдерживаемой страны может привести к блокировке аккаунта. Ни один способ не даёт гарантии — вы принимаете решение самостоятельно.")}
      <div class="selection-summary"><strong>Практический маршрут</strong><span>1. Выберите одну поддерживаемую страну, с которой у вас связан реальный способ оплаты. 2. Подключите стабильный платный VPN к серверу этой страны. 3. Сначала откройте web-версию ChatGPT в приватном окне. Не меняйте страны во время регистрации и оплаты.</span></div>
      <div class="checklist">${checkbox("connectionReady", "Я выбрала одну поддерживаемую страну и подготовила стабильное подключение к ней")}</div>` : "";
    stepCard.innerHTML = frame("02", "Доступ и устройство", state.route === "russia" ? "Подготовьте доступ и выберите устройство" : "Где будете создавать сайт?", `
      ${travel}${russiaGuide}<div class="choice-grid three">
        ${platform("computer", "Компьютер", "Установка не нужна — достаточно браузера", "https://chatgpt.com/", "Открыть ChatGPT")}
        ${platform("iphone", "iPhone или iPad", "Только официальное приложение OpenAI", "https://help.openai.com/en/articles/7908378-where-can-i-download-the-openai-chatgpt-ios-app-on-the-apple-app-store", "Инструкция OpenAI")}
        ${platform("android", "Android", "Android 7.0 или новее с Google Play", "https://help.openai.com/en/articles/8142208-chatgpt-android-app-faq", "Инструкция OpenAI")}
      </div>
      ${deviceGuide}
      ${notice("warning", "Устанавливайте только приложение, где разработчиком указан OpenAI. Не скачивайте APK и установочные файлы из Telegram или случайных сайтов.")}
      ${state.route === "russia" ? notice("info", "Если приложение не показывается в App Store или Google Play, начните с chatgpt.com в браузере. Регион магазина меняйте только с действительными данными и способом оплаты выбранной страны.") : ""}
      ${nav(1, 3, !state.platform || (state.route === "russia" && !state.connectionReady))}`);
    stepCard.querySelectorAll("[data-platform]").forEach((button) => button.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      setState({ platform: button.dataset.platform }); renderStep();
    }));
    bindCommon();
  }

  if (state.step === 3) {
    const russiaAccount = state.route === "russia"
      ? notice("info", "Создавайте только собственный аккаунт. При ошибке региона не переключайте VPN между странами: откройте приватное окно, очистите cookies и повторите вход через тот же сервер.")
      : "";
    stepCard.innerHTML = frame("03", "Аккаунт", "Проверьте вход и сохранность работы", `
      <p class="step-intro">Войдите на <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">официальном сайте ChatGPT ↗</a> и отметьте три пункта.</p>
      <div class="checklist">${checkbox("accountReady", "Я вошла в собственный аккаунт ChatGPT")}${checkbox("authRemembered", "Я помню способ входа: почта, Google, Apple или Microsoft")}${checkbox("historyReady", "После обновления страницы я вижу историю чата")}</div>
      ${notice("info", "Разные способы входа могут создать разные аккаунты. Всегда используйте тот же способ, которым регистрировались.")}
      ${russiaAccount}
      ${nav(2, 4, !(state.accountReady && state.authRemembered && state.historyReady))}`);
    bindCommon();
  }

  if (state.step === 4) {
    stepCard.innerHTML = frame("04", "Чат", "Отправьте первый рабочий запрос", `
      <p class="step-intro">Скопируйте текст, отправьте его в новый чат и посмотрите, задаёт ли ChatGPT вопросы по-русски.</p>
      <div class="prompt-box"><p>${testPrompt}</p><button type="button" id="copy-prompt">Скопировать запрос</button></div>
      <div class="checklist">${checkbox("chatReady", "Ответ пришёл на русском, и я могу продолжить диалог")}</div>
      ${nav(3, 5, !state.chatReady)}`);
    document.getElementById("copy-prompt").addEventListener("click", async (event) => {
      try { await navigator.clipboard.writeText(testPrompt); event.currentTarget.textContent = "Скопировано"; }
      catch (_) { event.currentTarget.textContent = "Выделите и скопируйте текст"; }
    });
    bindCommon();
  }

  if (state.step === 5) {
    stepCard.innerHTML = frame("05", "Голос", "Продиктуйте идею сайта", `
      <p class="step-intro">Нажмите микрофон и произнесите фразу. Запись обрабатывается возможностями вашего браузера; сайт её не сохраняет и никуда не отправляет.</p>
      <div class="voice-test" id="voice-test"><button type="button" class="voice-button" id="voice-button" aria-label="Начать голосовой ввод"><span class="voice-button-core"></span></button><div><strong id="voice-title">Голосовая проверка</strong><span id="voice-status">Нажмите и скажите: «Я создаю сайт для…»</span></div></div>
      <label class="voice-field"><span>Что распозналось</span><textarea id="voice-field" placeholder="Я создаю сайт для своего проекта…"></textarea></label>
      <div class="checklist">${checkbox("voiceReady", "Русская речь распозналась или я успешно использовала системную диктовку")}</div>
      ${nav(4, 6, !state.voiceReady)}`);
    const field = document.getElementById("voice-field"); field.value = voiceText;
    field.addEventListener("input", () => { voiceText = field.value; if (voiceText.trim().length > 8 && !state.voiceReady) { setState({ voiceReady: true }); renderStep(); } });
    document.getElementById("voice-button").addEventListener("click", startVoice);
    bindCommon();
  }

  if (state.step === 6) {
    stepCard.innerHTML = frame("06", "Файлы", "Проверьте работу с изображениями", `
      <p class="step-intro">Выберите безопасное тестовое изображение без документов и банковских данных. На этом сайте файл остаётся только в вашем браузере.</p>
      <label class="file-drop ${fileName ? "filled" : ""}"><input type="file" id="file-input" accept="image/*"><span class="file-symbol">＋</span><strong id="file-title">${fileName || "Выбрать тестовое изображение"}</strong><small id="file-subtitle">${fileName ? "Файл выбран. Мы его не загружаем." : "PNG, JPG или HEIC"}</small></label>
      <p class="micro-copy">Следом загрузите это же изображение в ChatGPT и попросите: «Опиши картинку и предложи, в каком разделе сайта её использовать».</p>
      <div class="checklist">${checkbox("fileReady", "ChatGPT принял изображение и смог его описать")}</div>
      ${nav(5, 7, !state.fileReady)}`);
    document.getElementById("file-input").addEventListener("change", (event) => {
      fileName = event.target.files?.[0]?.name || ""; setState({ fileReady: Boolean(fileName) }); renderStep();
    });
    bindCommon();
  }

  if (state.step === 7) {
    const paymentReady = state.route !== "russia" || state.plan === "free" || Boolean(state.paymentRoute);
    const paymentDetails = state.paymentRoute === "foreign-card" ? `
      <div class="selection-summary"><strong>Оплата иностранной картой · пошагово</strong><span>1. Оставьте подключение к той же стране, где выпущена карта. 2. В ChatGPT откройте профиль → Upgrade Plan → Get Plus. 3. Введите данные своей карты и соответствующий billing address. 4. После оплаты проверьте в Settings → Account, что активен Plus.</span></div>`
      : state.paymentRoute === "app-store" ? `
      <div class="selection-summary"><strong>Оплата через App Store · пошагово</strong><span>1. Войдите в официальное приложение именно в тот аккаунт ChatGPT, которым будете пользоваться. 2. Нажмите Get Plus. 3. Подтвердите подписку на странице оплаты Apple. 4. Если списание прошло, а тариф не появился: ChatGPT → Settings → Account → Restore purchases.</span><a href="https://help.openai.com/en/articles/7905739-chatgpt-ios-app-upgrading-to-a-paid-subscription" target="_blank" rel="noreferrer">Инструкция OpenAI ↗</a></div>`
      : state.paymentRoute === "google-play" ? `
      <div class="selection-summary"><strong>Оплата через Google Play · пошагово</strong><span>1. Войдите в официальный ChatGPT под нужным аккаунтом. 2. Выберите Upgrade или Get Plus. 3. Подтвердите подписку через платёжный профиль Google Play выбранной страны. 4. Управляйте подпиской в Google Play → Платежи и подписки → Подписки.</span></div>` : "";
    const russiaPayment = state.route === "russia" && state.plan === "plus" ? `
      <div class="selection-summary"><strong>Как оплатить Plus из России</strong><span>Выберите вариант, который у вас действительно есть. На сайте OpenAI Plus стоит $20 в месяц; цена в мобильном магазине показывается самим магазином.</span></div>
      <div class="choice-grid three">
        <button type="button" class="choice-card ${state.paymentRoute === "foreign-card" ? "selected" : ""}" data-payment="foreign-card"><span class="choice-label">Вариант 1</span><strong>Своя иностранная карта</strong><span>Карта выпущена банком поддерживаемой страны; платёжные данные и billing address совпадают.</span></button>
        <button type="button" class="choice-card ${state.paymentRoute === "app-store" ? "selected" : ""}" data-payment="app-store"><span class="choice-label">Вариант 2 · iPhone</span><strong>Оплата через App Store</strong><span>Apple Account, регион и действительный способ оплаты относятся к одной поддерживаемой стране.</span></button>
        <button type="button" class="choice-card ${state.paymentRoute === "google-play" ? "selected" : ""}" data-payment="google-play"><span class="choice-label">Вариант 3 · Android</span><strong>Оплата через Google Play</strong><span>Google Play account и платёжный профиль относятся к одной поддерживаемой стране.</span></button>
      </div>
      ${paymentDetails}
      ${notice("warning", "Не передавайте логин, пароль, код 2FA или банковский код сервисам оплаты. Не покупайте готовый аккаунт. Подписка в приложении привязывается и к аккаунту магазина, и к тому аккаунту ChatGPT, в который вы вошли при покупке.")}` : "";
    const russiaFree = state.route === "russia" && state.plan === "free"
      ? notice("info", "Можно пройти обучение на Free и перейти на Plus позже. Так вы сначала проверите доступ, голос и файлы без расходов.")
      : "";
    stepCard.innerHTML = frame("07", "Тариф и оплата", state.route === "russia" ? "Выберите тариф и способ оплаты" : "Проверьте тариф и инструменты", `
      <p class="step-intro">Начните с бесплатного аккаунта. Платный тариф нужен только тогда, когда вы увидели ограничения или отсутствие необходимого инструмента.</p>
      <div class="choice-grid two">
        <button type="button" class="choice-card ${state.plan === "free" ? "selected" : ""}" data-plan="free"><span class="choice-label">Для знакомства</span><strong>Free</strong><span>Подходит для диагностики, но лимиты на файлы и инструменты строже.</span></button>
        <button type="button" class="choice-card ${state.plan === "plus" ? "selected" : ""}" data-plan="plus"><span class="choice-label">Для практикума</span><strong>Plus · $20/месяц</strong><span>Более широкие лимиты, голос, изображения, файлы и дополнительные инструменты.</span><a href="https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus" target="_blank" rel="noreferrer">Условия OpenAI ↗</a></button>
      </div>
      ${russiaPayment}${russiaFree}
      <div class="checklist">${checkbox("toolsReady", "В моём аккаунте видны инструменты создания, редактирования и публикации, показанные в демонстрации практикума")}</div>
      ${notice("warning", "Не покупайте чужой аккаунт и не передавайте посреднику пароль или банковский код. Подписки App Store, Google Play и сайта могут списываться отдельно.")}
      ${nav(6, 8, !(state.plan && paymentReady && state.toolsReady), "Узнать результат")}`);
    stepCard.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      setState({ plan: button.dataset.plan, paymentRoute: button.dataset.plan === "free" ? "free" : (state.paymentRoute === "free" ? null : state.paymentRoute) });
      renderStep();
    }));
    stepCard.querySelectorAll("[data-payment]").forEach((button) => button.addEventListener("click", () => { setState({ paymentRoute: button.dataset.payment }); renderStep(); }));
    bindCommon();
  }

  if (state.step === 8) renderResult();
}

function platform(id, title, subtitle, href, action) {
  return `<button type="button" class="choice-card ${state.platform === id ? "selected" : ""}" data-platform="${id}"><strong>${title}</strong><span>${subtitle}</span><a href="${href}" target="_blank" rel="noreferrer">${action} ↗</a></button>`;
}

function completedChecks() {
  const accessReady = Boolean(state.platform) && (state.route !== "russia" || state.connectionReady);
  const paymentReady = state.route !== "russia" || state.plan === "free" || Boolean(state.paymentRoute);
  return [accessReady, state.accountReady && state.authRemembered && state.historyReady, state.chatReady, state.voiceReady, state.fileReady, Boolean(state.plan) && paymentReady && state.toolsReady].filter(Boolean).length;
}

function renderResult() {
  const score = completedChecks();
  let result;
  if (score === 6) result = { tone: "ready", label: state.route === "russia" ? "Маршрут для России пройден" : "Техническая готовность подтверждена", title: "Вы готовы создать сайт в ChatGPT", text: state.route === "russia" ? "Доступ, собственный аккаунт, голос, файлы и способ оплаты проверены. Помните: Россия официально не поддерживается OpenAI, поэтому доступ не гарантирован и риск блокировки остаётся." : "Аккаунт, голос, файлы и необходимые инструменты работают. В практикуме останется пройти путь от идеи до опубликованной ссылки." };
  else if (score >= 4) result = { tone: "partial", label: `${score} из 6 проверок пройдено`, title: "Почти готово", text: "Вернитесь к непройденным пунктам. Не оплачивайте практикум, пока не подтвердите доступ к нужным инструментам." };
  else result = { tone: "blocked", label: `${score} из 6 проверок пройдено`, title: "Пока оставайтесь на бесплатных материалах", text: "Сначала настройте ChatGPT и проверьте базовые функции. Так платный практикум принесёт результат, а не техническое раздражение." };

  const scoreBars = `<div class="score-line" aria-label="${score} из 6 проверок пройдено">${Array.from({ length: 6 }, (_, index) => `<i class="${index < score ? "filled" : ""}"></i>`).join("")}</div>`;
  let actions = "";
  if (result.tone === "ready") actions = `
    <section class="publish-map" aria-labelledby="publish-title">
      <div class="publish-heading">
        <span>Практическая карта для России</span>
        <h3 id="publish-title">Куда загружать сайт клиента</h3>
        <p>Не отдавайте клиенту адрес с вашим именем на GitHub. Рабочий сайт размещается на российском хостинге и открывается по собственному домену клиента.</p>
      </div>
      <div class="publish-flow" aria-label="Маршрут публикации сайта">
        <article><b>01</b><span>ChatGPT</span><strong>Скачайте готовый ZIP</strong><small>Внутри должен быть файл index.html и папки сайта.</small></article>
        <i aria-hidden="true">→</i>
        <article><b>02</b><span>Клиент</span><strong>Оформите домен и Beget</strong><small>Аккаунт, домен и оплата — сразу на имя владельца сайта.</small></article>
        <i aria-hidden="true">→</i>
        <article><b>03</b><span>Хостинг</span><strong>Загрузите и распакуйте ZIP</strong><small>Файлы помещаются в корневую папку созданного сайта.</small></article>
        <i aria-hidden="true">→</i>
        <article><b>04</b><span>Готово</span><strong>Подключите домен и SSL</strong><small>Проверьте адрес с телефона через Wi‑Fi и мобильную сеть.</small></article>
      </div>
      ${notice("info", "GitHub пригодится как резервная копия и история версий. Для посетителей используйте собственный домен клиента на Beget; REG.RU оставьте как альтернативу.")}
      <div class="publish-rules">
        <strong>Правило передачи клиенту</strong>
        <ul><li>Домен и хостинг принадлежат клиенту.</li><li>Вы получаете временный доступ только на время работы.</li><li>После проверки клиент меняет пароль или удаляет ваш доступ.</li></ul>
      </div>
    </section>
    <div class="offer-card"><span class="offer-kicker">Полный маршрут внутри STURZA LAB</span><h3>«Сайт в GPT: от идеи до своего домена»</h3><p>Без видеоуроков: короткие интерактивные экраны, готовые запросы для ChatGPT, скриншоты со стрелками и проверка каждого действия. Вы создадите сайт, исправите его с голоса, проверите мобильную версию и опубликуете на хостинге.</p><div class="offer-bottom"><strong>Стартовая цена · 7 900 ₽</strong><button type="button" disabled>Скоро откроем доступ</button></div></div>`;
  else actions = `<button class="result-primary" type="button" id="return-checks">Вернуться к проверкам</button>`;

  stepCard.innerHTML = frame("08", "Результат", result.title, `<div class="result-panel ${result.tone}"><span>${result.label}</span><p>${result.text}</p>${scoreBars}</div>${actions}${nav(7, null)}`);
  document.getElementById("return-checks")?.addEventListener("click", () => goToStep(2));
  bindCommon();
}

function continueFromRoute() {
  goToStep(2);
}

function goToStep(step) {
  recognition?.stop?.();
  setState({ step: Math.max(1, Math.min(8, step)) });
  renderStep();
  setTimeout(() => diagnostic.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

function startVoice() {
  if (recognition) { recognition.stop(); recognition = null; return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceTest = document.getElementById("voice-test");
  const title = document.getElementById("voice-title");
  const status = document.getElementById("voice-status");
  if (!Recognition) { status.textContent = "В этом браузере голосовой ввод недоступен. Используйте системную диктовку или введите текст вручную."; return; }
  recognition = new Recognition(); recognition.lang = "ru-RU"; recognition.continuous = false; recognition.interimResults = true;
  voiceTest.classList.add("listening"); title.textContent = "Слушаю вас…"; status.textContent = "Говорите естественно. Текст появится ниже.";
  recognition.onresult = (event) => {
    voiceText = Array.from(event.results).map((item) => item[0]?.transcript || "").join("");
    document.getElementById("voice-field").value = voiceText;
    if (voiceText.trim().length > 8) setState({ voiceReady: true });
  };
  recognition.onerror = () => { status.textContent = "Не удалось получить доступ к микрофону. Проверьте разрешение или введите текст вручную."; voiceTest.classList.remove("listening"); recognition = null; };
  recognition.onend = () => { voiceTest.classList.remove("listening"); title.textContent = "Голосовая проверка"; status.textContent = "Запись завершена. Проверьте текст ниже."; recognition = null; };
  recognition.start();
}

document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => { setState({ route: button.dataset.route, step: 1 }); updateRouteUI(); }));
document.getElementById("start-button").addEventListener("click", () => document.getElementById("route-start").scrollIntoView({ behavior: "smooth", block: "start" }));
document.getElementById("route-continue").addEventListener("click", continueFromRoute);
document.getElementById("reset-button").addEventListener("click", () => { state = { ...defaults }; voiceText = ""; fileName = ""; try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} updateRouteUI(); renderStep(); window.scrollTo({ top: 0, behavior: "smooth" }); });

updateRouteUI();
renderStep();

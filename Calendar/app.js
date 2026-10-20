(function () {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const STORAGE_KEY = "church-icons-catalog";
  const CSV_KEY = "church-icons-csv-url";

  const demoIcons = [
    {
      title: "Рождество Христово",
      oldStyle: "12-25",
      newStyle: "01-07",
      imageUrl: "",
      location: "Алтарная ризница",
      tags: ["Господский праздник"],
      notes: "Выносится на центральный аналой в день праздника."
    },
    {
      title: "Крещение Господне",
      oldStyle: "01-06",
      newStyle: "01-19",
      imageUrl: "",
      location: "Правый киот",
      tags: ["Господский праздник"],
      notes: ""
    },
    {
      title: "Святитель Николай Чудотворец",
      oldStyle: "12-06",
      newStyle: "12-19",
      imageUrl: "",
      location: "Левый киот",
      tags: ["Святитель"],
      notes: "Также 22 мая по новому стилю."
    },
    {
      title: "Казанская икона Божией Матери",
      oldStyle: "10-22",
      newStyle: "11-04",
      imageUrl: "",
      location: "Запасник",
      tags: ["Богородичный праздник"],
      notes: ""
    }
  ];

  const state = {
    icons: readStoredIcons() || demoIcons,
    query: ""
  };

  const els = {
    todayLabel: document.getElementById("todayLabel"),
    weekStrip: document.getElementById("weekStrip"),
    iconGrid: document.getElementById("iconGrid"),
    stats: document.getElementById("stats"),
    sheetUrl: document.getElementById("sheetUrl"),
    searchInput: document.getElementById("searchInput"),
    loadSheetButton: document.getElementById("loadSheetButton"),
    refreshButton: document.getElementById("refreshButton"),
    demoButton: document.getElementById("demoButton"),
    weekDayTemplate: document.getElementById("weekDayTemplate"),
    iconCardTemplate: document.getElementById("iconCardTemplate")
  };

  els.sheetUrl.value = localStorage.getItem(CSV_KEY) || "";
  els.todayLabel.textContent = formatLongDate(new Date());

  els.searchInput.addEventListener("input", function (event) {
    state.query = event.target.value.trim().toLowerCase();
    renderCatalog();
  });

  els.loadSheetButton.addEventListener("click", loadSheet);
  els.refreshButton.addEventListener("click", function () {
    if (els.sheetUrl.value.trim()) {
      loadSheet();
    } else {
      render();
    }
  });
  els.demoButton.addEventListener("click", function () {
    state.icons = demoIcons;
    saveIcons(state.icons);
    render();
  });

  render();

  async function loadSheet() {
    const url = normalizeSheetUrl(els.sheetUrl.value.trim());
    if (!url) return;

    els.loadSheetButton.disabled = true;
    els.loadSheetButton.textContent = "Загрузка";

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const csv = await response.text();
      const rows = parseCsv(csv);
      state.icons = rows.map(normalizeRow).filter(function (icon) {
        return icon.title;
      });
      localStorage.setItem(CSV_KEY, url);
      saveIcons(state.icons);
      render();
    } catch (error) {
      alert("Не удалось загрузить таблицу. Проверьте, что CSV опубликован для чтения.");
      console.error(error);
    } finally {
      els.loadSheetButton.disabled = false;
      els.loadSheetButton.textContent = "Загрузить";
    }
  }

  function render() {
    renderWeek();
    renderCatalog();
  }

  function renderWeek() {
    els.weekStrip.replaceChildren();
    const today = startOfDay(new Date());
    const dates = Array.from({ length: 7 }, function (_, index) {
      return addDays(today, index);
    });

    dates.forEach(function (date) {
      const node = els.weekDayTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".day-date").textContent = formatShortDate(date);
      node.querySelector(".day-name").textContent = formatWeekday(date);
      const iconList = node.querySelector(".day-icons");
      const icons = state.icons.filter(function (icon) {
        return matchesDate(icon, date);
      });

      if (!icons.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Нет назначенной иконы";
        iconList.append(empty);
      } else {
        icons.forEach(function (icon) {
          const row = document.createElement("div");
          row.className = "day-icon";
          const img = document.createElement("img");
          img.alt = icon.title;
          img.src = icon.imageUrl || placeholderImage(icon.title);
          const title = document.createElement("span");
          title.textContent = icon.title;
          row.append(img, title);
          iconList.append(row);
        });
      }

      els.weekStrip.append(node);
    });
  }

  function renderCatalog() {
    els.iconGrid.replaceChildren();
    const filtered = state.icons.filter(function (icon) {
      const haystack = [
        icon.title,
        icon.location,
        icon.notes,
        icon.tags.join(" ")
      ].join(" ").toLowerCase();
      return !state.query || haystack.includes(state.query);
    });

    els.stats.innerHTML = [
      pill("Всего: " + state.icons.length),
      pill("В поиске: " + filtered.length),
      pill("На неделю: " + countUpcoming())
    ].join("");

    filtered.forEach(function (icon) {
      const node = els.iconCardTemplate.content.firstElementChild.cloneNode(true);
      const img = node.querySelector("img");
      img.src = icon.imageUrl || placeholderImage(icon.title);
      img.alt = icon.title;
      node.querySelector("h3").textContent = icon.title;
      node.querySelector(".meta").textContent = buildMeta(icon);
      node.querySelector(".notes").textContent = icon.notes || "";
      const tags = node.querySelector(".tags");
      icon.tags.forEach(function (tag) {
        const chip = document.createElement("span");
        chip.className = "tag";
        chip.textContent = tag;
        tags.append(chip);
      });
      els.iconGrid.append(node);
    });
  }

  function normalizeRow(row) {
    const fileName = pick(row, ["file", "filename", "файл", "имя файла", "название файла"]);
    const title = pick(row, ["title", "название", "икона", "name"]) || titleFromFileName(fileName);
    const date = pick(row, ["date", "дата", "iso"]);
    const oldStyle = pick(row, ["old_style", "старый стиль", "ст. стиль", "юлианская дата"]);
    const newStyle = pick(row, ["new_style", "новый стиль", "н. стиль", "григорианская дата"]);
    const tags = pick(row, ["tags", "теги", "категория", "тип"]);
    const imageUrl = pick(row, [
      "image_url",
      "url",
      "photo",
      "фото",
      "ссылка",
      "картинка",
      "cloudflare",
      "cloudflare r2",
      "r2",
      "ссылка cloudflare",
      "ссылка на cloudflare",
      "ссылка на cloudflare r2",
      "ссылка на фото"
    ]);
    return {
      title: title,
      date: date,
      oldStyle: normalizeMonthDay(oldStyle),
      newStyle: normalizeMonthDay(newStyle || date),
      imageUrl: normalizeImageUrl(imageUrl),
      location: pick(row, ["location", "место", "расположение", "где находится"]),
      tags: tags ? tags.split(/[,;]+/).map(clean).filter(Boolean) : [],
      notes: pick(row, ["notes", "заметки", "примечание", "комментарий"])
    };
  }

  function matchesDate(icon, date) {
    const iso = toIsoDate(date);
    if (icon.date && icon.date === iso) return true;
    if (icon.newStyle && icon.newStyle === toMonthDay(date)) return true;
    if (icon.oldStyle && oldStyleToDate(icon.oldStyle, date.getFullYear()) === iso) return true;
    if (icon.oldStyle && oldStyleToDate(icon.oldStyle, date.getFullYear() - 1) === iso) return true;
    return false;
  }

  function oldStyleToDate(monthDay, year) {
    const parts = monthDay.split("-").map(Number);
    const julianAsGregorian = new Date(year, parts[0] - 1, parts[1] + 13);
    return toIsoDate(julianAsGregorian);
  }

  function countUpcoming() {
    const today = startOfDay(new Date());
    return state.icons.filter(function (icon) {
      return Array.from({ length: 7 }, function (_, index) {
        return addDays(today, index);
      }).some(function (date) {
        return matchesDate(icon, date);
      });
    }).length;
  }

  function buildMeta(icon) {
    const dates = [];
    if (icon.newStyle) dates.push(icon.newStyle + " н. ст.");
    if (icon.oldStyle) dates.push(icon.oldStyle + " ст. ст.");
    if (icon.date && !icon.newStyle) dates.push(icon.date);
    if (icon.location) dates.push(icon.location);
    return dates.join(" · ");
  }

  function parseCsv(csv) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const next = csv[index + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    rows.push(row);

    const headers = rows.shift().map(function (header) {
      return clean(header).toLowerCase();
    });

    return rows.filter(function (values) {
      return values.some(function (value) { return clean(value); });
    }).map(function (values) {
      return headers.reduce(function (record, header, index) {
        record[header] = clean(values[index] || "");
        return record;
      }, {});
    });
  }

  function normalizeSheetUrl(url) {
    if (!url) return "";
    if (url.includes("output=csv")) return url;
    const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) return url;
    const gid = (url.match(/[?&]gid=(\d+)/) || [])[1] || "0";
    return "https://docs.google.com/spreadsheets/d/" + match[1] + "/export?format=csv&gid=" + gid;
  }

  function normalizeImageUrl(url) {
    if (!url) return "";
    const fileMatch = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    if (!fileMatch) return url;
    return "https://drive.google.com/thumbnail?id=" + fileMatch[1] + "&sz=w900";
  }

  function titleFromFileName(fileName) {
    return clean(fileName)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function placeholderImage(title) {
    const initials = encodeURIComponent((title || "И").slice(0, 2).toUpperCase());
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">' +
        '<rect width="400" height="500" fill="#eadfcb"/>' +
        '<rect x="28" y="28" width="344" height="444" rx="12" fill="#fff8eb" stroke="#b58a3a" stroke-width="8"/>' +
        '<circle cx="200" cy="190" r="72" fill="#b58a3a" opacity=".28"/>' +
        '<text x="200" y="295" text-anchor="middle" font-family="Georgia,serif" font-size="70" fill="#8f2f2f">' + initials + '</text>' +
      '</svg>'
    );
  }

  function pick(row, names) {
    for (const name of names) {
      const key = name.toLowerCase();
      if (row[key]) return clean(row[key]);
    }
    return "";
  }

  function normalizeMonthDay(value) {
    const cleaned = clean(value);
    if (!cleaned) return "";
    const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return pad(iso[2]) + "-" + pad(iso[3]);
    const dotted = cleaned.match(/^(\d{1,2})[./](\d{1,2})$/);
    if (dotted) return pad(dotted[2]) + "-" + pad(dotted[1]);
    const dashed = cleaned.match(/^(\d{1,2})-(\d{1,2})$/);
    if (dashed) return pad(dashed[1]) + "-" + pad(dashed[2]);
    return cleaned;
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function saveIcons(icons) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(icons));
  }

  function readStoredIcons() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toIsoDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function toMonthDay(date) {
    return pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short"
    }).format(date);
  }

  function formatWeekday(date) {
    return new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(date);
  }

  function pill(text) {
    return '<span class="stat-pill">' + text + '</span>';
  }
}());

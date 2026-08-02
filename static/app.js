// Global State
let chatData = null;
let windowStartIndex = 0; // Oldest rendered global index in current view
let currentMessageIndex = 0; // Newest rendered global index in current view
let lastRenderedDate = null;
let tomSelectInstance = null;
let activeAliases = [];
let contactGroups = [];
let groupTomSelects = {};

const BATCH_SIZE = 50;

$(document).ready(async function () {
  dayjs.extend(window.dayjs_plugin_customParseFormat);
  lucide.createIcons();

  // 1. Mobile Drawer & Search Arena Controls
  $("#btn-open-sidebar").click(function () {
    $("#sidebar").removeClass("-translate-x-full").addClass("translate-x-0");
  });

  $("#btn-close-sidebar").click(function () {
    $("#sidebar").removeClass("translate-x-0").addClass("-translate-x-full");
  });

  $("#btn-search-open").click(function () {
    $("#search-arena-view").removeClass("hidden").addClass("flex");
    $("#search-input").focus();
    lucide.createIcons();
  });

  $("#btn-search-close-arena, #btn-close-rhs-search").click(function () {
    closeSearchArena();
  });

  $("#btn-search-clear-input").click(function (e) {
    e.stopPropagation();
    $("#search-input").val("").focus();
    $(this).addClass("hidden");
    executeSearch();
  });

  function closeSearchArena() {
    $("#search-input").val("");
    $("#btn-search-clear-input").addClass("hidden");
    $("#search-arena-view").addClass("hidden").removeClass("flex");
    $("#rhs-search-panel")
      .addClass("translate-x-full hidden")
      .removeClass("flex translate-x-0");
    $(".msg-bubble").removeClass("ring-2 ring-[#00a884] scale-[1.01]");
  }

  // Load saved timestamp options
  const showSecs = localStorage.getItem("opt_show_seconds") === "true";
  const showDate = localStorage.getItem("opt_show_date") === "true";
  $("#opt-show-seconds").prop("checked", showSecs);
  $("#opt-show-date").prop("checked", showDate);

  // Dynamic timestamp toggle event listeners
  $("#opt-show-seconds, #opt-show-date").on("change", function () {
    localStorage.setItem(
      "opt_show_seconds",
      $("#opt-show-seconds").is(":checked"),
    );
    localStorage.setItem("opt_show_date", $("#opt-show-date").is(":checked"));
    if (chatData) {
      resetAndRenderPaginated();
    }
  });

  // 2. Load Saved Contact Groups & LocalForage
  const savedGroups = localStorage.getItem("whatsapp_contact_groups");
  if (savedGroups) {
    try {
      contactGroups = JSON.parse(savedGroups);
    } catch (e) {}
  }

  try {
    const storedData = await localforage.getItem("whatsapp_chat_data");
    if (storedData) {
      chatData = storedData;
      initSidebar(storedData);
    }
  } catch (e) {
    console.error("Error loading cached data", e);
  }

  // 3. FilePond Upload
  const pond = FilePond.create(document.querySelector(".filepond"), {
    server: {
      process: (fieldName, file, metadata, load, error, progress, abort) => {
        NProgress.start();
        const formData = new FormData();
        formData.append(fieldName, file);

        $.ajax({
          url: "/api/upload",
          type: "POST",
          data: formData,
          contentType: false,
          processData: false,
          xhr: function () {
            const xhr = new window.XMLHttpRequest();
            xhr.upload.addEventListener(
              "progress",
              function (evt) {
                if (evt.lengthComputable)
                  progress(evt.lengthComputable, evt.loaded, evt.total);
              },
              false,
            );
            return xhr;
          },
          success: async function (data) {
            NProgress.done();
            load(data);
            chatData = data;

            await localforage.setItem("whatsapp_chat_data", data);
            initSidebar(data);
          },
          error: function () {
            NProgress.done();
            error("Upload failed");
            Toastify({
              text: "Failed to parse chat file.",
              backgroundColor: "#ef4444",
            }).showToast();
          },
        });
        return {
          abort: () => {
            abort();
          },
        };
      },
    },
  });

  // 4. Initialize Sidebar
  function initSidebar(data) {
    if (!data.participants || data.participants.length === 0) return;

    $("#stat-total").text(data.messages.length.toLocaleString());
    $("#stat-participants").text(data.participants.length);

    $("#upload-screen").fadeOut(300, function () {
      $("#main-app").removeClass("hidden").addClass("flex");
      lucide.createIcons();
    });

    if (tomSelectInstance) tomSelectInstance.destroy();

    tomSelectInstance = new TomSelect("#user-select", {
      options: data.participants.map((p) => ({ value: p, text: p })),
      plugins: ["remove_button"],
      create: false,
    });

    const savedAliasesStr = Cookies.get("selected_aliases");
    if (savedAliasesStr) {
      try {
        const savedAliases = JSON.parse(savedAliasesStr);
        const validAliases = savedAliases.filter((alias) =>
          data.participants.includes(alias),
        );
        tomSelectInstance.setValue(validAliases);
      } catch (e) {}
    }

    Object.values(groupTomSelects).forEach((ts) => ts.destroy());
    groupTomSelects = {};
    $("#contact-groups-list").empty();

    if (contactGroups && contactGroups.length > 0) {
      contactGroups.forEach((group) => addGroupCard(group));
    }
  }

  // 5. Dynamic Person Card Creator
  function addGroupCard(groupData = { id: null, name: "", aliases: [] }) {
    const groupContainer = $("#contact-groups-list");
    const cardId =
      groupData.id ||
      "group_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

    const card = $(`
            <div class="contact-group-card bg-[#202c33] p-3 rounded-lg border border-[#2a3942] space-y-2 relative" data-card-id="${cardId}">
                <button type="button" class="btn-remove-group absolute top-2 right-2 text-[#8696a0] hover:text-red-400 p-1 rounded transition" title="Delete Person">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
                <div>
                    <label class="block text-[10px] text-[#8696a0] font-medium uppercase mb-1">Person Name</label>
                    <input type="text" class="group-name-input bg-[#2a3942] text-[#e9edef] text-xs rounded p-1.5 w-full border border-[#374955] focus:border-[#00a884] focus:outline-none" placeholder="e.g. Sarah" value="${escapeHtml(groupData.name || "")}">
                </div>
                <div>
                    <label class="block text-[10px] text-[#8696a0] font-medium uppercase mb-1">Merge Aliases</label>
                    <select class="group-aliases-select" id="select-${cardId}" multiple placeholder="Select aliases..."></select>
                </div>
            </div>
        `);

    groupContainer.append(card);
    lucide.createIcons();

    if (chatData && chatData.participants) {
      const ts = new TomSelect(`#select-${cardId}`, {
        options: chatData.participants.map((p) => ({ value: p, text: p })),
        plugins: ["remove_button"],
        create: false,
      });

      if (groupData.aliases && groupData.aliases.length > 0) {
        ts.setValue(groupData.aliases);
      }

      groupTomSelects[cardId] = ts;
    }

    card.find(".btn-remove-group").click(function () {
      if (groupTomSelects[cardId]) {
        groupTomSelects[cardId].destroy();
        delete groupTomSelects[cardId];
      }
      card.remove();
    });
  }

  $("#btn-add-group").click(function () {
    addGroupCard();
  });

  function getDisplaySender(rawSender) {
    for (let i = 0; i < contactGroups.length; i++) {
      const grp = contactGroups[i];
      if (grp.aliases && grp.aliases.includes(rawSender) && grp.name) {
        return grp.name;
      }
    }
    return rawSender;
  }

  // 6. Apply Settings
  $("#btn-apply").click(function () {
    const selected = tomSelectInstance.getValue();
    if (!selected || selected.length === 0) {
      Toastify({
        text: "Please select at least one alias for yourself.",
        backgroundColor: "#f59e0b",
      }).showToast();
      return;
    }

    Cookies.set("selected_aliases", JSON.stringify(selected), { expires: 365 });
    activeAliases = selected;

    contactGroups = [];
    $(".contact-group-card").each(function () {
      const cardId = $(this).data("card-id");
      const name = $(this).find(".group-name-input").val().trim();
      const ts = groupTomSelects[cardId];
      const aliases = ts ? ts.getValue() : [];

      if (name && aliases.length > 0) {
        contactGroups.push({ id: cardId, name: name, aliases: aliases });
      }
    });

    localStorage.setItem(
      "whatsapp_contact_groups",
      JSON.stringify(contactGroups),
    );

    $("#btn-search-open").removeClass("hidden");
    $("#search-input").val("");
    $("#btn-search-clear-input").addClass("hidden");

    resetAndRenderPaginated();

    $("#sidebar").removeClass("translate-x-0").addClass("-translate-x-full");
    Toastify({
      text: "Chat loaded seamlessly.",
      duration: 2000,
      backgroundColor: "#00a884",
    }).showToast();
  });

  function resetAndRenderPaginated() {
    windowStartIndex = 0;
    currentMessageIndex = 0;
    lastRenderedDate = null;
    $("#chat-container").empty();
    renderBatch();
  }

  function escapeHtml(text) {
    return $("<div>").text(text).html();
  }
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Timestamp Formatting Helper
  function formatMessageTime(timeStr, dateStr) {
    let formatted = timeStr;
    const showSeconds = $("#opt-show-seconds").is(":checked");
    const showDate = $("#opt-show-date").is(":checked");

    if (!showSeconds) {
      formatted = formatted.replace(
        /:(\d{2})(\s*[\u202F\s]*[AaPp][Mm])?$/,
        "$2",
      );
    }

    if (showDate) {
      formatted = `${dateStr} ${formatted}`;
    }

    return formatted;
  }

  // 7. Single Message Render Engine
  function renderSingleMessage(msg, container, globalIdx) {
    if (msg.type === "system") {
      container.append(`
                <div class="flex justify-center my-2 text-center">
                    <div class="bg-[#182229] text-[#8696a0] text-[10px] md:text-[11px] px-3.5 py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm max-w-[90%] md:max-w-[85%] leading-relaxed border border-[#222d34] flex items-center justify-center gap-2">
                        <i data-lucide="lock" class="w-3 h-3 flex-shrink-0"></i>
                        <span>${msg.text}</span>
                    </div>
                </div>
            `);
      return;
    }

    const isMe = activeAliases.includes(msg.sender);
    const alignClass = isMe ? "self-end" : "self-start";
    const bgClass = isMe ? "bg-[#005c4b]" : "bg-[#202c33]";
    const borderRadiusClass = isMe
      ? "rounded-tl-xl rounded-b-xl rounded-tr-sm"
      : "rounded-tr-xl rounded-b-xl rounded-tl-sm";

    const displaySender = getDisplaySender(msg.sender);
    const displayText = escapeHtml(msg.text);
    const formattedTime = formatMessageTime(msg.time, msg.date);
    const editedIcon = msg.is_edited
      ? `<i data-lucide="pencil" class="w-2.5 h-2.5 text-[#8696a0] opacity-80" title="Edited"></i>`
      : "";

    const bubble = $(`
            <div class="flex flex-col ${alignClass} max-w-[88%] sm:max-w-[75%] md:max-w-[65%] min-w-[100px] mb-1.5 md:mb-2 msg-wrapper" data-msg-global-index="${globalIdx}">
                <div class="${bgClass} ${borderRadiusClass} p-2 px-3 shadow-sm relative msg-bubble transition-all duration-200" data-tippy-content="Sent at ${msg.time}">
                    ${!isMe ? `<div class="text-[11px] md:text-xs font-semibold text-[#53bdeb] mb-0.5">${escapeHtml(displaySender)}</div>` : ""}
                    <div class="text-xs md:text-sm text-[#e9edef] msg-text">${displayText}</div>
                    <div class="text-[9px] md:text-[10px] text-[#8696a0] text-right mt-1 ml-4 -mb-1 flex justify-end items-center gap-1">
                        ${editedIcon}
                        ${formattedTime}
                        ${isMe ? `<i data-lucide="check-check" class="w-3 h-3 text-[#53bdeb]"></i>` : ""}
                    </div>
                </div>
            </div>
        `);
    container.append(bubble);
  }

  // 8. Range Render Engine (Memory & CPU safe)
  function renderRange(startIdx, endIdx, appendDirection = "append") {
    if (!chatData || startIdx >= chatData.messages.length) return;

    const sliceEnd = Math.min(chatData.messages.length, endIdx);
    const batch = chatData.messages.slice(startIdx, sliceEnd);
    const fragment = $(document.createDocumentFragment());

    let dateTracker = null;

    batch.forEach((msg, idx) => {
      const absoluteIdx = startIdx + idx;

      let msgDate = dayjs(msg.date, [
        "DD/MM/YYYY",
        "MM/DD/YYYY",
        "DD/MM/YY",
        "MM/DD/YY",
      ]);
      let displayDate = msgDate.isValid()
        ? msgDate.format("MMMM D, YYYY")
        : msg.date;

      if (displayDate !== dateTracker && msg.type !== "system") {
        fragment.append(`
                    <div class="flex justify-center my-2.5 md:my-3">
                        <div class="bg-[#182229] text-[#8696a0] text-[10px] md:text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg shadow-sm">
                            ${displayDate}
                        </div>
                    </div>
                `);
        dateTracker = displayDate;
      }

      renderSingleMessage(msg, fragment, absoluteIdx);
    });

    const container = $("#chat-container");

    if (appendDirection === "prepend") {
      container.prepend(fragment);
    } else {
      container.append(fragment);
    }

    // Initialize icons & tooltips ONLY on new uninitialized nodes
    lucide.createIcons();

    const uninitBubbles = container
      .find(".msg-bubble")
      .filter(function () {
        return !this._tippy;
      })
      .toArray();

    if (uninitBubbles.length > 0) {
      tippy(uninitBubbles, {
        theme: "light",
        animation: "scale",
        delay: [200, 0],
      });
    }
  }

  function renderBatch() {
    if (!chatData || currentMessageIndex >= chatData.messages.length) return;
    const nextIndex = Math.min(
      chatData.messages.length,
      currentMessageIndex + BATCH_SIZE,
    );
    renderRange(currentMessageIndex, nextIndex, "append");
    currentMessageIndex = nextIndex;
  }

  function prependBatch() {
    if (!chatData || windowStartIndex <= 0) return;
    const prevIndex = Math.max(0, windowStartIndex - BATCH_SIZE);

    const container = $("#chat-container");
    const oldScrollHeight = container[0].scrollHeight;
    const oldScrollTop = container.scrollTop();

    renderRange(prevIndex, windowStartIndex, "prepend");
    windowStartIndex = prevIndex;

    const newScrollHeight = container[0].scrollHeight;
    container.scrollTop(oldScrollTop + (newScrollHeight - oldScrollHeight));
  }

  // Bi-directional Scroll Listener
  $("#chat-container").on("scroll", function () {
    const container = $(this);

    // Scroll DOWN -> load future messages
    if (
      container.scrollTop() + container.innerHeight() >=
      container[0].scrollHeight - 300
    ) {
      renderBatch();
    }

    // Scroll UP -> load past messages
    if (container.scrollTop() <= 50 && windowStartIndex > 0) {
      prependBatch();
    }
  });

  $(document).on("click", "#btn-load-earlier", function () {
    prependBatch();
  });

  // 9. Instant Jump Engine (Zero memory overhead)
  function jumpToMessageIndex(targetIdx) {
    if (!chatData || targetIdx < 0 || targetIdx >= chatData.messages.length)
      return;

    let targetWrapper = $(`[data-msg-global-index="${targetIdx}"]`);

    // If target message is NOT currently in DOM, jump render window directly around targetIdx, don't fuck with my brain!!!!
    if (targetWrapper.length === 0) {
      $("#chat-container").empty();

      const start = Math.max(0, targetIdx - 20);
      const end = Math.min(chatData.messages.length, targetIdx + 40);

      windowStartIndex = start;
      currentMessageIndex = end;
      lastRenderedDate = null;

      if (windowStartIndex > 0) {
        $("#chat-container").append(`
                    <div id="earlier-msgs-indicator" class="flex justify-center my-2">
                        <button id="btn-load-earlier" class="bg-[#182229] hover:bg-[#202c33] text-[#00a884] text-xs px-3 py-1.5 rounded-lg border border-[#222d34] transition">
                            Scroll up or click to load earlier messages
                        </button>
                    </div>
                `);
      }

      renderRange(start, end, "append");
      targetWrapper = $(`[data-msg-global-index="${targetIdx}"]`);
    }

    if (targetWrapper.length > 0) {
      $(".msg-bubble").removeClass("ring-2 ring-[#00a884] scale-[1.01]");
      const bubble = targetWrapper.find(".msg-bubble");
      bubble.addClass("ring-2 ring-[#00a884] scale-[1.01]");

      targetWrapper[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if ($(window).width() < 768) {
      $("#rhs-search-panel")
        .addClass("translate-x-full hidden")
        .removeClass("flex translate-x-0");
    }
  }

  // 10. Search Options Popover
  $("#btn-search-opts").click(function (e) {
    e.stopPropagation();
    $("#search-opts-menu").toggleClass("hidden");
  });
  $(document).click(function () {
    $("#search-opts-menu").addClass("hidden");
  });
  $("#search-opts-menu").click(function (e) {
    e.stopPropagation();
  });

  // 11. RHS Search Panel Engine
  function executeSearch() {
    const query = $("#search-input").val().trim();
    const rhsContainer = $("#rhs-search-results");
    const matchCase = $("#opt-case").is(":checked");
    const wholeWord = $("#opt-word").is(":checked");

    if (query.length === 0) {
      $("#btn-search-clear-input").addClass("hidden");
      $("#rhs-search-panel")
        .addClass("translate-x-full hidden")
        .removeClass("flex translate-x-0");
      return;
    }

    $("#btn-search-clear-input").removeClass("hidden");

    let flags = "g";
    if (!matchCase) flags += "i";

    const escapedSafeQuery = escapeRegExp(escapeHtml(query));
    const regexPattern = wholeWord
      ? `\\b${escapedSafeQuery}\\b`
      : escapedSafeQuery;
    const searchRegex = new RegExp(regexPattern, flags);

    const results = [];
    for (let i = 0; i < chatData.messages.length; i++) {
      const msg = chatData.messages[i];
      if (msg.type !== "system") {
        const escapedText = escapeHtml(msg.text);
        const displaySender = getDisplaySender(msg.sender);

        if (
          searchRegex.test(escapedText) ||
          searchRegex.test(msg.sender) ||
          searchRegex.test(displaySender)
        ) {
          const highlightedText = escapedText.replace(
            searchRegex,
            (match) =>
              `<mark class="bg-[#00a884] text-[#0b141a] px-0.5 rounded-sm font-semibold">${match}</mark>`,
          );
          results.push({
            ...msg,
            globalIndex: i,
            highlightedText: highlightedText,
            displaySender: displaySender,
          });
        }
      }
    }

    $("#rhs-search-panel")
      .removeClass("hidden translate-x-full")
      .addClass("flex translate-x-0");
    $("#rhs-search-count").text(`${results.length.toLocaleString()} matches`);
    rhsContainer.empty();

    if (results.length === 0) {
      rhsContainer.append(
        `<div class="text-center text-[#8696a0] mt-10 text-xs md:text-sm">No messages found for "${query}"</div>`,
      );
      return;
    }

    results.slice(0, 150).forEach((res) => {
      const formattedTime = formatMessageTime(res.time, res.date);
      const item = $(`
                <div class="rhs-result-item bg-[#202c33] hover:bg-[#2a3942] p-2.5 md:p-3 rounded-lg border border-[#2a3942] cursor-pointer transition space-y-1" data-global-index="${res.globalIndex}">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-[#53bdeb] truncate max-w-[140px]">${escapeHtml(res.displaySender)}</span>
                        <span class="text-[10px] text-[#8696a0]">${formattedTime}</span>
                    </div>
                    <p class="text-xs text-[#e9edef] line-clamp-2 leading-snug">${res.highlightedText}</p>
                </div>
            `);

      item.click(function () {
        const idx = $(this).data("global-index");
        jumpToMessageIndex(idx);
      });

      rhsContainer.append(item);
    });

    if (results.length > 150) {
      rhsContainer.append(
        `<div class="text-center text-[#8696a0] mt-4 text-xs italic">Showing top 150 matches...</div>`,
      );
    }
  }

  $("#search-input").on("input", executeSearch);
  $("#opt-case, #opt-word").on("change", executeSearch);

  // 12. Clear & Logout
  $("#btn-logout").click(async function () {
    await localforage.removeItem("whatsapp_chat_data");
    Cookies.remove("selected_aliases");
    localStorage.removeItem("whatsapp_contact_groups");
    localStorage.removeItem("opt_show_seconds");
    localStorage.removeItem("opt_show_date");

    chatData = null;
    windowStartIndex = 0;
    currentMessageIndex = 0;
    lastRenderedDate = null;
    activeAliases = [];
    contactGroups = [];

    Object.values(groupTomSelects).forEach((ts) => ts.destroy());
    groupTomSelects = {};
    $("#contact-groups-list").empty();

    $("#sidebar").removeClass("translate-x-0").addClass("-translate-x-full");
    $("#btn-search-open").addClass("hidden");
    $("#search-arena-view").addClass("hidden").removeClass("flex");
    $("#rhs-search-panel")
      .addClass("translate-x-full hidden")
      .removeClass("flex translate-x-0");
    $("#main-app").removeClass("flex").addClass("hidden");
    $("#chat-container").empty();
    $("#search-input").val("");
    pond.removeFiles();

    $("#upload-screen").fadeIn(300);
    Toastify({
      text: "All data cleared successfully.",
      backgroundColor: "#0ea5e9",
    }).showToast();
  });
});

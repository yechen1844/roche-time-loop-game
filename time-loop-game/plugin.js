/* eslint-disable */
/**
 * 时间循环文游 - Roche 插件
 * 三种命运：土拨鼠之日 / 忌日快乐 / 明日边缘
 *
 * 术语约定：
 *   本次循环 (Loop) = 一次完整时间循环
 *   本回合 (Turn)   = 一次主 API 输出
 *   回合三段式      = 副 API 1 (回合前) → 主 API (回合中) → 副 API 2 (回合后)
 *
 * 禁止 emoji：所有图标用 inline SVG。
 * 副 API 提示词强规范，召回失败重试一次。
 */
(function () {
  "use strict";

  // ============================================================
  // 常量与默认值
  // ============================================================
  const ROOT_CLASS = "roche-plugin-time-loop-game";
  const DB_NAME = "roche-plugin-time-loop-game";
  const DB_VERSION = 1;
  const STORAGE_KEYS = {
    state: "tlg-state",
    settings: "tlg-settings",
    customGames: "tlg-custom-games",
    saves: "tlg-saves",
    logs: "tlg-logs",
  };

  const MODE = {
    GROUNDHOG: "groundhog",
    HAPPY_DEATH: "happy-death",
    EDGE_TOMORROW: "edge-tomorrow",
  };

  const MODE_LABEL = {
    [MODE.GROUNDHOG]: "土拨鼠之日",
    [MODE.HAPPY_DEATH]: "忌日快乐",
    [MODE.EDGE_TOMORROW]: "明日边缘",
  };

  const DEFAULT_SETTINGS = {
    logEnabled: false,
    safeTop: 0,
    safeBottom: 0,
    theme: "dark",
    streamEnabled: true,
    apiConfig: {
      main: { useRoche: true, provider: "", model: "", endpoint: "", apiKey: "", temperature: 0.85 },
      sub1: { useRoche: true, provider: "", model: "", endpoint: "", apiKey: "", temperature: 0.3 },
      sub2: { useRoche: true, provider: "", model: "", endpoint: "", apiKey: "", temperature: 0.2 },
    },
  };

  // ============================================================
  // 工具函数
  // ============================================================
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "style") node.setAttribute("style", attrs[k]);
        else if (k === "innerHTML") node.innerHTML = attrs[k];
        else if (k === "value") node.value = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    }
    return node;
  }

  function svgIcon(name, size) {
    const s = size || 20;
    const paths = {
      back: '<path d="M15 18l-6-6 6-6"/>',
      close: '<path d="M18 6L6 18M6 6l12 12"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
      skull: '<path d="M12 2C6.5 2 2 6 2 11c0 3 1.5 5 3 6v3h2v-2h2v2h6v-2h2v2h2v-3c1.5-1 3-3 3-6 0-5-4.5-9-10-9z"/><circle cx="8.5" cy="11" r="1.5"/><circle cx="15.5" cy="11" r="1.5"/>',
      clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
      users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
      clue: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
      log: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
      play: '<polygon points="5 3 19 12 5 21 5 3"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      edit: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
      save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
      refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
      location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
      menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    };
    const p = paths[name] || paths.book;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  function uid() {
    return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ============================================================
  // 存储层
  // ============================================================
  const Store = {
    async get(key) {
      try {
        const v = await window.Roche.storage.get(key);
        return v;
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      await window.Roche.storage.set(key, value);
    },
    async del(key) {
      await window.Roche.storage.delete(key);
    },
  };

  // 独立 IndexedDB（大数据）
  const IDB = {
    _db: null,
    async open() {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("loopHistory")) db.createObjectStore("loopHistory", { keyPath: "id" });
          if (!db.objectStoreNames.contains("rawLogs")) db.createObjectStore("rawLogs", { keyPath: "id" });
        };
        req.onsuccess = (e) => {
          this._db = e.target.result;
          resolve(this._db);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    },
    async add(store, value) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).add(value);
        tx.oncomplete = () => resolve(value);
        tx.onerror = (e) => reject(e.target.error);
      });
    },
    async getAll(store) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    },
    async clear(store) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      });
    },
  };

  // ============================================================
  // 系统日志
  // ============================================================
  const Logger = {
    async log(entry) {
      const settings = await Store.get(STORAGE_KEYS.settings) || DEFAULT_SETTINGS;
      if (!settings.logEnabled) return;
      const id = uid();
      const record = { id, ts: Date.now(), ...entry };
      try {
        await IDB.add("rawLogs", record);
      } catch (e) {
        // 忽略日志写入失败
      }
    },
    async getAll() {
      try {
        const all = await IDB.getAll("rawLogs");
        return all.sort((a, b) => b.ts - a.ts);
      } catch (e) {
        return [];
      }
    },
    async clear() {
      try {
        await IDB.clear("rawLogs");
      } catch (e) {}
    },
  };

  // ============================================================
  // API 调用层（三段式，含强规范与重试）
  // ============================================================
  const API = {
    async call(role, messages, opts) {
      const settings = await Store.get(STORAGE_KEYS.settings) || DEFAULT_SETTINGS;
      const cfg = settings.apiConfig[role] || settings.apiConfig.main;
      const params = {
        messages,
        temperature: cfg.temperature,
      };
      if (!cfg.useRoche) {
        if (cfg.provider) params.provider = cfg.provider;
        if (cfg.model) params.model = cfg.model;
        if (cfg.endpoint) params.endpoint = cfg.endpoint;
        if (cfg.apiKey) params.apiKey = cfg.apiKey;
      }
      const result = await window.Roche.ai.chat(params);
      const text = result.text || "";
      await Logger.log({ role, messages, reply: text, loopNumber: opts && opts.loopNumber, turnNumber: opts && opts.turnNumber });
      return text;
    },

    async callWithRetry(role, messages, opts) {
      try {
        return await this.call(role, messages, opts);
      } catch (e) {
        // 召回失败重试一次
        try {
          return await this.call(role, messages, opts);
        } catch (e2) {
          throw e2;
        }
      }
    },

    // 副 API 2 专用：强规范 JSON 输出，解析失败则重试一次
    async callSub2ForJSON(messages, opts) {
      let text = await this.callWithRetry("sub2", messages, opts);
      let parsed = this._tryParseJSON(text);
      if (parsed) return parsed;
      // 重试一次，加强 JSON 指令
      const retry = messages.concat([{ role: "user", content: "请严格只输出一个 JSON 对象，不要任何额外文字、不要代码块标记。直接以 { 开头 } 结尾。" }]);
      text = await this.callWithRetry("sub2", retry, opts);
      parsed = this._tryParseJSON(text);
      if (parsed) return parsed;
      throw new Error("副 API 2 返回无法解析的 JSON");
    },

    // 副 API 1 专用：强规范 JSON 输出，解析失败则重试一次
    async callSub1ForJSON(messages, opts) {
      let text = await this.callWithRetry("sub1", messages, opts);
      let parsed = this._tryParseJSON(text);
      if (parsed) return parsed;
      const retry = messages.concat([{ role: "user", content: "请严格只输出一个 JSON 对象，不要任何额外文字、不要代码块标记。直接以 { 开头 } 结尾。" }]);
      text = await this.callWithRetry("sub1", retry, opts);
      parsed = this._tryParseJSON(text);
      if (parsed) return parsed;
      throw new Error("副 API 1 返回无法解析的 JSON");
    },

    // 流式调用：每收到一段文本回调 onChunk(chunkText, fullText)，完成后返回完整 text
    // 流式失败时降级为非流式调用
    async callStream(role, messages, opts, onChunk) {
      const settings = await Store.get(STORAGE_KEYS.settings) || DEFAULT_SETTINGS;
      const cfg = settings.apiConfig[role] || settings.apiConfig.main;
      const params = {
        messages,
        temperature: cfg.temperature,
        stream: true,
        rawResponse: true,
      };
      if (!cfg.useRoche) {
        if (cfg.provider) params.provider = cfg.provider;
        if (cfg.model) params.model = cfg.model;
        if (cfg.endpoint) params.endpoint = cfg.endpoint;
        if (cfg.apiKey) params.apiKey = cfg.apiKey;
      }
      try {
        const response = await window.Roche.ai.chat(params);
        const body = response && response.body;
        if (!body || typeof body.getReader !== "function") {
          throw new Error("流式响应不可用");
        }
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const chunk = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || "";
              if (chunk) {
                fullText += chunk;
                if (onChunk) onChunk(chunk, fullText);
              }
            } catch (e) {
              // 忽略非 JSON 行
            }
          }
        }
        await Logger.log({ role, messages, reply: fullText, loopNumber: opts && opts.loopNumber, turnNumber: opts && opts.turnNumber });
        return fullText;
      } catch (e) {
        // 降级为非流式
        const text = await this.call(role, messages, opts);
        if (onChunk) onChunk(text, text);
        return text;
      }
    },

    _tryParseJSON(text) {
      if (!text) return null;
      // 去除代码块
      let t = text.trim();
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      // 尝试提取第一个 {...}
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch (e) {
        return null;
      }
    },
  };

  // ============================================================
  // 副 API 强规范提示词
  // ============================================================
  const Prompts = {
    // 副 API 1：回合前合并调用，同时生成本回合剧本种子 + 检索相关记忆 id
    sub1Turn(userAction, usedClues, crossLoopMemory, baseWorldSetting, baseSeed, memoryTable, location, time, characters, mode, loopNumber) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的「回合前剧本生成器 + 记忆检索器」。你的任务：根据 user 本回合行动，生成「本回合剧本种子」并检索相关记忆，输出一个 JSON 对象。

【严格规则】
1. 只输出一个 JSON 对象，不要任何额外文字、不要代码块标记、不要解释。
2. 直接以 { 开头 } 结尾。
3. 字段名严格固定：seed（字符串）、recallMemoryIds（字符串数组）。
4. seed = 本回合剧本种子（一段纯文本）：user 当前要去的地点/时间/人物的世界状态 + NPC 行动 + 事件触发点。
5. seed 必须与基础剧本种子保持一致（NPC 行动时间线、事件触发条件、默认走向），除非 user 行动产生蝴蝶效应。
6. seed 篇幅控制在 300-600 字，精简摘要，不要写完整剧情。
7. 若 user 去的是新地点：基于基础世界设定补齐该地点的状态。
8. 若 user 在不同时间探索相同地点：按基础种子推演该时间点的状态。
9. 剧本种子只描述角色/地点/时间/NPC 今天会遭遇的事件，可给 user 任务条件（如今天要交作业否则挂科），【绝对禁止】替 user 做出任何行动。user 可以自己选择是否去做这些事。
10. recallMemoryIds：从「本次循环记忆表」的 id 列表中挑选与本回合 user 行动最相关的记忆 id，最少 0 条最多 15 条，按相关性排序。若记忆表为空，返回空数组 []。只返回已存在的 id，不要编造。

【基础世界设定】
${baseWorldSetting || "（无）"}

【基础剧本种子（隐藏，固定底座）】
${baseSeed || "（无）"}

【当前模式】${MODE_LABEL[mode] || mode}，第 ${loopNumber} 次循环

【当前地点】${location || "（未指定）"}
【当前时间】${time || "（未指定）"}
【在场人物】${(characters || []).map(c => c.name || c.handle).join("、") || "（无）"}

【跨循环记忆（user 已掌握，可供参考）】
${(crossLoopMemory || []).slice(-15).map(m => "- " + (m.summary || m.text || "")).join("\n") || "（无）"}

【本次循环记忆表（含 id 与原文，模型只挑选 id）】
${(memoryTable || []).map(m => "- id: " + (m.id || "(无id)") + " | " + (m.summary || "")).join("\n") || "（空）"}

【user 本回合行动】
${userAction}

【user 本回合使用的线索】
${(usedClues || []).map(c => "- " + (c.summary || c.text || "")).join("\n") || "（无）"}

【输出 JSON 格式（严格遵守字段名）】
{
  "seed": "本回合剧本种子文本",
  "recallMemoryIds": ["mem-id-1", "mem-id-2"]
}

请输出 JSON：`,
        },
        { role: "user", content: "请开始。" },
      ];
    },

    // 主 API：推剧情（自判死亡/破局 + 思维链 + 人称）
    mainNarrate(injects) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的主剧情生成器。

【核心规则】
1. 基于本回合剧本种子推进剧情。
2. 先思考再输出正文。
3. 【绝对禁止】替 user 行动、说话、做决定。你只能描述世界、NPC、环境对 user 行动的反应。user 的行动只能由 user 自己输入。违反此规则会彻底破坏游戏。
4. 没有任何一次死亡会被轻视。
5. 死亡判定：只有当 user 的行动或局势必然导致死亡时才 died=true，不要随意杀害 user。
6. 破局判定：当达成破局条件时 loopEndMet=true。
7. 选项必须有意义、有分支感，不要敷衍，给出 3-4 个不同方向的选项。
8. 若 user 行动会触发即兴线索（如 char 透露秘密），自然写入正文。

【输出格式（严格按以下结构，不要省略任何标记）】
【思考】
（分析当前局势、user 行动的可能后果、是否触发死亡条件、是否达成破局条件。这是你的内部思考，user 看不到。）

【正文】
（剧情正文，${injects.person || "第三人称"}，文风遵循设定。绝对不要替 user 做出任何行动、决定、说话。只描述世界、NPC、环境对 user 行动的反应。）

【选项】
1. 选项一
2. 选项二
3. 选项三
4. 选项四

【判定】
{"death":{"died":false,"cause":"","details":""},"loopEndMet":false}

【基础世界设定】
${injects.baseWorldSetting || "（无）"}

【本回合剧本种子】
${injects.turnSeed || "（无）"}

【文风】
${injects.style || "（无）"}

【user 人设】
${injects.userPersona || "（无）"}

【在场 char 核心档案（完整人设，不省略）】
${(injects.charProfiles || []).map(c => "### " + (c.handle || c.name) + "\n" + (c.persona || c.bio || "")).join("\n\n") || "（无）"}

【在场 char 详细记忆】
${(injects.charDetails || []).map(c => "### " + (c.handle || c.name) + "\n" + (c.detailMemory || "")).join("\n\n") || "（无）"}

【本次循环已检索到的相关记忆】
${(injects.recalledMemories || []).map(s => "- " + s).join("\n") || "（无）"}

【前两回合 user 输入与模型输出（仅正文）】
${(injects.prevTurns || []).map(t => "### user：" + t.userInput + "\n模型：" + t.modelOutput).join("\n\n") || "（无）"}

【user 数值】
${JSON.stringify(injects.userStats || {}, null, 0)}

【常驻指令】
${(injects.standingOrders || []).join("\n") || "（无）"}

【模式规则】
${injects.modeRules || "（无）"}

【user 本回合行动】
${injects.userAction || "（无）"}

【user 本回合使用的线索】
${(injects.usedClues || []).map(c => "- " + (c.summary || c.text || "")).join("\n") || "（无）"}

请严格按上述格式输出，包含【思考】【正文】【选项】【判定】四个标记。`,
    },
    { role: "user", content: "请开始。" },
  ];
},

    // 副 API 2-总结：滞后到下一回合开始时调用，对「已确认的上一回合主API输出」做一次
    // 写记忆表 / 地点表 / 时间表 / 人物表 / 挑稳定线索 / 跨循环记忆摘要
    // 判定（死亡/破局）已交由主 API 自判，此处不再做判定。
    sub2Summary(modelOutput, state, mode, location, time, characters) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的「回合总结器」。分析本回合已确认的主 API 输出，更新四张表 + 挑稳定线索 + 生成跨循环记忆摘要。严格输出一个 JSON 对象。

【严格规则】
1. 只输出一个 JSON 对象，不要任何额外文字、不要代码块标记。
2. 直接以 { 开头 } 结尾。
3. 字段名严格固定，不可更改、不可增删。
4. 不要在总结里输出 death 或 loopEndMet 字段（判定已由主 API 完成）。
5. memoryEntry 中的 id 字段由前端生成，你不需要输出 id 字段。

【本回合主 API 输出】
${modelOutput}

【当前状态】
- 模式：${MODE_LABEL[mode] || mode}
- 第 ${state.loopNumber} 次循环，第 ${state.turnNumber} 回合
- 当前地点：${location || "（未指定）"}
- 当前时间：${time || "（未指定）"}
- 在场人物：${(characters || []).map(c => c.name || c.handle).join("、") || "（无）"}
- 破局条件：${state.loopEndCondition || "（隐藏）"}

【输出 JSON 格式（严格遵守字段名）】
{
  "memoryEntry": {
    "summary": "本次循环本回合经历的一句话总结",
    "location": "地点",
    "time": "时间",
    "characters": ["涉及人物名"]
  },
  "newLocation": "若 user 首次到达新地点，填地点名；否则填 null",
  "timeUpdate": "本回合更新后的当前时间",
  "characterUpdates": [
    { "name": "人物名", "loopInteraction": "本次循环与该人物的交互摘要", "crossLoopObservation": "跨循环观察摘要（若有新增）" }
  ],
  "stableClues": [
    { "summary": "稳定线索摘要", "type": "stable", "detail": "详情" }
  ],
  "crossLoopMemorySummary": "本回合跨循环记忆摘要（user 跨循环可记住的关键信息）"
}

请输出 JSON：`,
        },
        { role: "user", content: "请开始。" },
      ];
    },

    // 副 API 1：破局结局，总结相关 char 每次循环记忆
    sub1Ending(charCrossLoopMemories, userPersona, mode) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的「结局生成器」。user 已破局。请总结相关 char 的每次循环记忆，生成 char 视角的震撼结局叙事。

【严格规则】
1. 输出一段结局叙事正文，第三人称。
2. 呈现 char 视角的漫长等待/终于等到 user 破局的震撼感。
3. 篇幅 500-1000 字。
4. 不要输出选项，这是结局。

【user 人设】
${userPersona || "（无）"}

【模式】${MODE_LABEL[mode] || mode}

【相关 char 的每次循环记忆】
${(charCrossLoopMemories || []).map(c => "### " + (c.name || c.handle) + "\n" + (c.crossLoopObservation || "")).join("\n\n") || "（无）"}

请输出结局叙事：`,
        },
        { role: "user", content: "请开始。" },
      ];
    },

    // 创建存档：主 API 生成基础世界设定 + 开场序幕（分两部分输出）
    mainCreateWorld(mode, userPersona, charList, task, worldview, person) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的「世界设定生成器」。基于 user 输入生成基础世界设定与开场序幕。

【严格规则】
1. 输出分两部分，分别用 \`【世界设定】\` 和 \`【开场序幕】\` 标记开头，两部分都必须出现，按顺序输出。
2. 【世界设定】：固定底座。包含：世界背景、主要地点、关键人物关系、时间线框架。若有任务，写入任务、达成条件、循环开始/结束点。写入死亡判定条件与回溯规则。篇幅 800-1500 字。
3. 【开场序幕】：游戏第一回合 user 看到的开场剧情。${person || "第三人称"}，呈现 user 进入循环起点的场景、氛围与初始状况。不要替 user 做决定或行动。篇幅 300-600 字。
4. 不要输出选项，开场序幕只描述场景。

【模式】${MODE_LABEL[mode] || mode}

【user 人设】
${userPersona || "（无）"}

【char 列表】
${(charList || []).map(c => "### " + (c.handle || c.name) + "\n" + (c.persona || c.bio || "")).join("\n\n") || "（无）"}

【任务（若有）】
${task || "（无）"}

【user 输入的世界观】
${worldview || "（无）"}

请输出（含两部分标记）：`,
        },
        { role: "user", content: "请开始。" },
      ];
    },

    // 创建存档：副 API 生成基础剧本种子
    subCreateSeed(baseWorldSetting, mode, charList) {
      return [
        {
          role: "system",
          content: `你是时间循环文游的「剧本种子生成器」。基于基础世界设定，生成隐藏的基础剧本种子。

【严格规则】
1. 只输出纯文本，不要 JSON、不要代码块。
2. 剧本种子 = 世界的「默认运行规律」：NPC 行动时间线、事件触发条件、默认走向、关键时间节点的世界状态。
3. 这是固定底座，每回合副 API 1 会基于它生成本回合种子。
4. 篇幅 600-1200 字，精简摘要。
5. 若是隐藏条件模式（土拨鼠之日隐藏 / 忌日快乐 / 明日边缘），在此设定隐藏的破局条件或死亡真相，但不要在正文中暴露给 user。

【基础世界设定】
${baseWorldSetting || "（无）"}

【模式】${MODE_LABEL[mode] || mode}

【char 列表】
${(charList || []).map(c => "### " + (c.handle || c.name) + "\n" + (c.persona || c.bio || "")).join("\n\n") || "（无）"}

请输出基础剧本种子：`,
        },
        { role: "user", content: "请开始。" },
      ];
    },
  };

  // ============================================================
  // 样式（三种 UI 风格，禁用 emoji）
  // ============================================================
  const CSS = `
  .${ROOT_CLASS} {
    --tlg-safe-top: 0px;
    --tlg-safe-bottom: 0px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: #e8e8e8;
    background: #0d0d0f;
    overflow: hidden;
  }
  .${ROOT_CLASS} *, .${ROOT_CLASS} *::before, .${ROOT_CLASS} *::after {
    box-sizing: border-box;
  }
  .${ROOT_CLASS} .tlg-topbar {
    padding-top: var(--tlg-safe-top);
    flex-shrink: 0;
  }
  .${ROOT_CLASS} .tlg-bottombar {
    padding-bottom: var(--tlg-safe-bottom);
    flex-shrink: 0;
  }
  .${ROOT_CLASS} .tlg-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  /* === 土拨鼠之日：欢快明亮 === */
  .${ROOT_CLASS}.mode-groundhog {
    background: linear-gradient(180deg, #fff8e7 0%, #ffe8c2 100%);
    color: #5a3e1b;
  }
  .${ROOT_CLASS}.mode-groundhog .tlg-card {
    background: rgba(255,255,255,0.85);
    border: 1px solid #f0c987;
    border-radius: 16px;
  }
  .${ROOT_CLASS}.mode-groundhog .tlg-btn {
    background: #ff9f43; color: #fff; border: none; border-radius: 24px;
  }
  .${ROOT_CLASS}.mode-groundhog .tlg-btn-ghost {
    background: transparent; color: #b8761e; border: 1px solid #f0c987;
  }

  /* === 忌日快乐：惊悚暗黑 === */
  .${ROOT_CLASS}.mode-happy-death {
    background: linear-gradient(180deg, #0a0a0c 0%, #1a0a0e 100%);
    color: #c8c8d0;
  }
  .${ROOT_CLASS}.mode-happy-death .tlg-card {
    background: rgba(30,15,20,0.85);
    border: 1px solid #4a1520;
    border-radius: 4px;
  }
  .${ROOT_CLASS}.mode-happy-death .tlg-btn {
    background: #8b0000; color: #e8e8e8; border: 1px solid #5a0000; border-radius: 2px;
  }
  .${ROOT_CLASS}.mode-happy-death .tlg-btn-ghost {
    background: transparent; color: #a83040; border: 1px solid #4a1520;
  }

  /* === 明日边缘：硬核冷峻 === */
  .${ROOT_CLASS}.mode-edge-tomorrow {
    background: linear-gradient(180deg, #0f1419 0%, #1a2330 100%);
    color: #b8c4d0;
  }
  .${ROOT_CLASS}.mode-edge-tomorrow .tlg-card {
    background: rgba(20,30,45,0.85);
    border: 1px solid #2a4060;
    border-radius: 2px;
  }
  .${ROOT_CLASS}.mode-edge-tomorrow .tlg-btn {
    background: #2a6090; color: #e8f0fa; border: 1px solid #1a4060; border-radius: 0;
  }
  .${ROOT_CLASS}.mode-edge-tomorrow .tlg-btn-ghost {
    background: transparent; color: #5a90c0; border: 1px solid #2a4060;
  }

  /* === 通用组件 === */
  .${ROOT_CLASS} .tlg-topbar {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; padding-top: calc(10px + var(--tlg-safe-top));
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .${ROOT_CLASS} .tlg-topbar .tlg-title { font-size: 16px; font-weight: 600; flex: 1; }
  .${ROOT_CLASS} .tlg-icon-btn {
    width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: inherit; cursor: pointer; border-radius: 8px;
  }
  .${ROOT_CLASS} .tlg-icon-btn:hover { background: rgba(255,255,255,0.08); }
  .${ROOT_CLASS} .tlg-content { padding: 14px; padding-bottom: calc(14px + var(--tlg-safe-bottom)); }
  .${ROOT_CLASS} .tlg-card { padding: 16px; margin-bottom: 12px; }
  .${ROOT_CLASS} .tlg-btn {
    padding: 10px 20px; font-size: 14px; cursor: pointer; transition: opacity 0.2s;
  }
  .${ROOT_CLASS} .tlg-btn:hover { opacity: 0.88; }
  .${ROOT_CLASS} .tlg-btn-ghost { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px; background: transparent; }
  .${ROOT_CLASS} .tlg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .${ROOT_CLASS} .tlg-input, .${ROOT_CLASS} .tlg-textarea, .${ROOT_CLASS} .tlg-select {
    width: 100%; padding: 10px 12px; font-size: 14px; border-radius: 8px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: inherit;
  }
  .${ROOT_CLASS} .tlg-textarea { min-height: 100px; resize: vertical; font-family: inherit; }
  .${ROOT_CLASS} .tlg-label { font-size: 13px; opacity: 0.75; margin-bottom: 6px; display: block; }
  .${ROOT_CLASS} .tlg-row { display: flex; gap: 10px; align-items: center; }
  .${ROOT_CLASS} .tlg-row-wrap { flex-wrap: wrap; }
  .${ROOT_CLASS} .tlg-gap-8 { gap: 8px; }
  .${ROOT_CLASS} .tlg-mt-8 { margin-top: 8px; }
  .${ROOT_CLASS} .tlg-mt-16 { margin-top: 16px; }
  .${ROOT_CLASS} .tlg-mb-8 { margin-bottom: 8px; }
  .${ROOT_CLASS} .tlg-mb-16 { margin-bottom: 16px; }
  .${ROOT_CLASS} .tlg-faded { opacity: 0.6; font-size: 12px; }
  .${ROOT_CLASS} .tlg-prose { line-height: 1.8; font-size: 15px; white-space: pre-wrap; word-break: break-word; }
  .${ROOT_CLASS} .tlg-option {
    display: block; width: 100%; text-align: left; padding: 12px 16px; margin-bottom: 8px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; cursor: pointer; color: inherit; font-size: 14px;
  }
  .${ROOT_CLASS} .tlg-option:hover { background: rgba(255,255,255,0.12); }
  .${ROOT_CLASS} .tlg-tag {
    display: inline-block; padding: 2px 8px; font-size: 11px; border-radius: 4px;
    background: rgba(255,255,255,0.1); margin-right: 4px;
  }
  .${ROOT_CLASS} .tlg-tag-stable { background: rgba(80,160,80,0.25); }
  .${ROOT_CLASS} .tlg-tag-event { background: rgba(160,120,80,0.25); }
  .${ROOT_CLASS} .tlg-tag-death { background: rgba(160,40,40,0.3); }
  .${ROOT_CLASS} .tlg-tag-location { background: rgba(80,120,160,0.25); }
  .${ROOT_CLASS} .tlg-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .${ROOT_CLASS} .tlg-table th, .${ROOT_CLASS} .tlg-table td {
    padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .${ROOT_CLASS} .tlg-table th { opacity: 0.7; font-weight: 600; }
  .${ROOT_CLASS} .tlg-clue-card {
    padding: 12px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; cursor: pointer; transition: background 0.15s;
  }
  .${ROOT_CLASS} .tlg-clue-card:hover { background: rgba(255,255,255,0.08); }
  .${ROOT_CLASS} .tlg-clue-card.selected { border-color: #5a90c0; background: rgba(90,144,192,0.15); }
  .${ROOT_CLASS} .tlg-status-bar {
    display: flex; gap: 16px; padding: 8px 14px; font-size: 12px; opacity: 0.75;
    border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    padding-bottom: var(--tlg-safe-bottom);
  }
  .${ROOT_CLASS} .tlg-loading {
    display: flex; align-items: center; justify-content: center; padding: 40px; opacity: 0.6;
  }
  .${ROOT_CLASS} .tlg-sidebar {
    position: absolute; top: 0; right: 0; bottom: 0; width: 80%; max-width: 420px;
    background: rgba(15,15,18,0.98); z-index: 100; transform: translateX(100%);
    transition: transform 0.25s; display: flex; flex-direction: column;
  }
  .${ROOT_CLASS}.sidebar-open .tlg-sidebar { transform: translateX(0); }
  .${ROOT_CLASS} .tlg-sidebar-overlay {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4);
    z-index: 99; display: none;
  }
  .${ROOT_CLASS}.sidebar-open .tlg-sidebar-overlay { display: block; }
  .${ROOT_CLASS} .tlg-tab-bar {
    display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
  }
  .${ROOT_CLASS} .tlg-tab {
    padding: 10px 14px; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent;
  }
  .${ROOT_CLASS} .tlg-tab.active { border-bottom-color: #5a90c0; }
  .${ROOT_CLASS} .tlg-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 12px 0; }
  .${ROOT_CLASS} .tlg-empty { text-align: center; padding: 40px 20px; opacity: 0.4; font-size: 14px; }

  /* === 滑块 === */
  .${ROOT_CLASS} .tlg-range { width: 100%; accent-color: #5a90c0; }

  /* === 悬浮球 + 菜单 + 小窗 === */
  .${ROOT_CLASS} .tlg-fab {
    position: fixed; right: 20px; bottom: calc(20px + var(--tlg-safe-bottom, 0px));
    width: 52px; height: 52px; border-radius: 50%;
    background: #5a90c0; color: #fff;
    border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  .${ROOT_CLASS}.mode-groundhog .tlg-fab { background: #ff9f43; }
  .${ROOT_CLASS}.mode-happy-death .tlg-fab { background: #8b0000; }
  .${ROOT_CLASS}.mode-edge-tomorrow .tlg-fab { background: #2a6090; }
  .${ROOT_CLASS} .tlg-fab-menu {
    position: fixed; right: 20px; bottom: calc(80px + var(--tlg-safe-bottom, 0px));
    background: rgba(20,20,24,0.98); border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4); padding: 8px; z-index: 101;
    display: flex; flex-direction: column; gap: 4px; min-width: 140px;
    color: #e8e8e8;
  }
  .${ROOT_CLASS} .tlg-fab-menu button {
    background: transparent; border: none; padding: 8px 12px; text-align: left;
    cursor: pointer; border-radius: 8px; color: inherit; font-size: 14px;
  }
  .${ROOT_CLASS} .tlg-fab-menu button:hover { background: rgba(255,255,255,0.1); }
  .${ROOT_CLASS} .tlg-fab-panel {
    position: fixed; right: 20px; bottom: calc(80px + var(--tlg-safe-bottom, 0px));
    width: min(420px, calc(100vw - 40px)); max-height: 60vh;
    background: rgba(20,20,24,0.98); color: #e8e8e8;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 102;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .${ROOT_CLASS} .tlg-fab-panel-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;
  }
  .${ROOT_CLASS} .tlg-fab-panel-body { padding: 12px 16px; overflow-y: auto; flex: 1; }
  .${ROOT_CLASS} .tlg-fab-panel-body .tlg-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  }

  /* === 主 API 选项按钮 === */
  .${ROOT_CLASS} .tlg-option-btn {
    display: block; width: 100%; text-align: left;
    padding: 10px 14px; margin-bottom: 6px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
    cursor: pointer; color: inherit; font-size: 14px; transition: background 0.15s;
  }
  .${ROOT_CLASS} .tlg-option-btn:hover { background: rgba(255,255,255,0.1); }
  .${ROOT_CLASS} .tlg-option-btn.used { opacity: 0.5; }

  /* === 思维链折叠 === */
  .${ROOT_CLASS} .tlg-thinking-toggle {
    font-size: 12px; opacity: 0.6; cursor: pointer; margin-bottom: 8px;
    padding: 4px 8px; border-radius: 4px; display: inline-block;
    border: 1px solid rgba(255,255,255,0.15);
  }
  .${ROOT_CLASS} .tlg-thinking-body {
    font-size: 12px; opacity: 0.7; white-space: pre-wrap; word-break: break-word;
    background: rgba(255,255,255,0.04); padding: 10px; border-radius: 6px; margin-bottom: 12px;
    border-left: 3px solid rgba(255,255,255,0.2);
  }

  /* === 主题（日间 / 夜间），作用于悬浮球面板与菜单 === */
  .${ROOT_CLASS}[data-theme="light"] .tlg-fab-panel {
    background: #f0f8f8; color: #2a3a3a;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
  }
  .${ROOT_CLASS}[data-theme="light"] .tlg-fab-panel-head {
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }
  .${ROOT_CLASS}[data-theme="light"] .tlg-fab-panel-body .tlg-card {
    background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08);
  }
  .${ROOT_CLASS}[data-theme="light"] .tlg-fab-menu {
    background: #f0f8f8; color: #2a3a3a;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  }
  .${ROOT_CLASS}[data-theme="light"] .tlg-fab-menu button:hover {
    background: rgba(0,0,0,0.06);
  }
  .${ROOT_CLASS}[data-theme="dark"] .tlg-fab-panel {
    background: rgba(20,20,24,0.98); color: #e0e0e0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }
  .${ROOT_CLASS}[data-theme="dark"] .tlg-fab-panel-head {
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .${ROOT_CLASS}[data-theme="dark"] .tlg-fab-panel-body .tlg-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  }
  .${ROOT_CLASS}[data-theme="dark"] .tlg-fab-menu {
    background: rgba(20,20,24,0.98); color: #e0e0e0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .${ROOT_CLASS}[data-theme="dark"] .tlg-fab-menu button:hover {
    background: rgba(255,255,255,0.1);
  }
  `;

  // ============================================================
  // 应用状态
  // ============================================================
  const App = {
    root: null,
    container: null,
    roche: null,
    route: "home",
    routeData: null,
    state: null, // 当前存档状态
    settings: null,
    listeners: [],
    routeStack: [], // 路由栈，用于 settings/logs 等覆盖层返回
    fabOpen: false, // 悬浮球菜单是否展开
    fabPanel: null, // 当前打开的悬浮小窗类型

    on(event, fn) {
      this.listeners.push({ event, fn });
    },
    emit(event, data) {
      this.listeners.filter(l => l.event === event).forEach(l => l.fn(data));
    },

    async loadSettings() {
      this.settings = (await Store.get(STORAGE_KEYS.settings)) || DEFAULT_SETTINGS;
      return this.settings;
    },
    async saveSettings() {
      await Store.set(STORAGE_KEYS.settings, this.settings);
    },

    navigate(route, data) {
      if (route === "settings" || route === "logs") {
        if (!this.routeStack) this.routeStack = [];
        this.routeStack.push({ route: this.route, data: this.routeData });
      } else {
        this.routeStack = [];
      }
      this.route = route;
      this.routeData = data || null;
      UI.render();
    },

    goBack() {
      if (this.routeStack && this.routeStack.length > 0) {
        const prev = this.routeStack.pop();
        this.route = prev.route;
        this.routeData = prev.data;
        UI.render();
      } else {
        this.route = "home";
        this.routeData = null;
        UI.render();
      }
    },

    setMode(mode) {
      [MODE.GROUNDHOG, MODE.HAPPY_DEATH, MODE.EDGE_TOMORROW].forEach(m => {
        this.root.classList.remove("mode-" + m);
      });
      if (mode) this.root.classList.add("mode-" + mode);
    },

    applySafeArea() {
      this.root.style.setProperty("--tlg-safe-top", (this.settings.safeTop || 0) + "px");
      this.root.style.setProperty("--tlg-safe-bottom", (this.settings.safeBottom || 0) + "px");
    },

    applyTheme() {
      if (!this.root) return;
      const theme = (this.settings && this.settings.theme) || "dark";
      this.root.setAttribute("data-theme", theme);
    },
  };

  // ============================================================
  // 引擎：四张表、循环状态、回合三段式
  // ============================================================
  const Engine = {
    async initState(mode, userPersona, charList, task, baseWorldSetting, baseSeed, style, standingOrders, person, openingScene) {
      const state = {
        id: uid(),
        mode,
        loopNumber: 1,
        turnNumber: 1,
        loopStartPoint: "",
        loopTrigger: mode === MODE.GROUNDHOG ? "day-end-or-condition" : "user-death",
        loopEndCondition: task || "",
        loopEndMet: false,
        deathCount: 0,
        baseWorldSetting,
        baseScenarioSeed: baseSeed,
        openingScene: openingScene || "", // 开场序幕（第一回合显示）
        person: person || "第三人称", // 主 API 正文人称
        userPersonaId: userPersona && userPersona.id,
        charIds: (charList || []).map(c => c.id),
        task,
        memoryTable: [], // 本次循环记忆表，回溯清空。每条记忆含 id 字段（前端生成）
        locationTable: [], // 地点表，回溯保留
        timeTable: { currentTime: "" }, // 时间表，回溯重置
        characterTable: {}, // 人物表 { charId: { name, loopInteraction, crossLoopObservation, present } }
        crossLoopMemory: [], // 跨循环记忆摘要，回溯保留
        clueTable: [], // 线索表，回溯保留
        deathTable: [], // 死亡表，回溯保留
        rewindTable: [], // 回溯表，回溯保留
        prevTurns: [], // 前两回合 { userInput, modelOutput（完整原始输出） }
        hiddenHint: "", // 隐藏条件提示
        style: style || "", // 文风
        standingOrders: Array.isArray(standingOrders) ? standingOrders : [], // 常驻指令（字符串数组）
        pendingMainOutput: "", // 当前回合已生成但尚未被副2-总结的主API输出
        lastInjects: null, // 上一次主 API 的 injects 快照（供 rerollMain 使用）
        createdAt: Date.now(),
      };
      // 初始化人物表（charList 里的所有 char 默认在场）
      (charList || []).forEach(c => {
        state.characterTable[c.id] = {
          name: c.name || c.handle,
          handle: c.handle,
          loopInteraction: "",
          crossLoopObservation: "",
          present: true,
          isCore: true,
        };
      });
      await this.saveState(state);
      return state;
    },

    async saveState(state) {
      await Store.set(STORAGE_KEYS.state, state);
    },

    async loadState() {
      return await Store.get(STORAGE_KEYS.state);
    },

    // ===== 多存档管理 =====
    async getAllSaves() {
      const arr = await Store.get(STORAGE_KEYS.saves);
      return Array.isArray(arr) ? arr : [];
    },

    async deleteSave(id) {
      const saves = await this.getAllSaves();
      const filtered = saves.filter(s => s.id !== id);
      await Store.set(STORAGE_KEYS.saves, filtered);
    },

    // 把当前 App.state 作为快照写入 saves 数组（同 id 覆盖，否则新增）
    // name 可选；不传则使用「模式名-第N次循环」，覆盖时保留原 name
    async saveCurrent(state, name) {
      if (!state) return;
      const saves = await this.getAllSaves();
      const idx = saves.findIndex(s => s.id === state.id);
      const modeLabel = MODE_LABEL[state.mode] || state.mode;
      const existingName = idx >= 0 ? saves[idx].name : null;
      const existingCreatedAt = idx >= 0 ? saves[idx].createdAt : null;
      const saveName = name || existingName || (modeLabel + "-第" + state.loopNumber + "次循环");
      const createdAt = existingCreatedAt || Date.now();
      const entry = {
        id: state.id,
        name: saveName,
        mode: state.mode,
        loopNumber: state.loopNumber,
        turnNumber: state.turnNumber,
        deathCount: state.deathCount,
        createdAt: createdAt,
        updatedAt: Date.now(),
        state: state,
      };
      if (idx >= 0) {
        saves[idx] = entry;
      } else {
        saves.push(entry);
      }
      await Store.set(STORAGE_KEYS.saves, saves);
    },

    async loadSave(id) {
      const saves = await this.getAllSaves();
      const save = saves.find(s => s.id === id);
      return save ? save.state : null;
    },

    // 取最近更新的存档（用于「继续上一次游戏」）
    async getLatestSave() {
      const saves = await this.getAllSaves();
      if (!saves.length) return null;
      const sorted = saves.slice().sort((a, b) => {
        const ta = a.updatedAt || a.createdAt || 0;
        const tb = b.updatedAt || b.createdAt || 0;
        return tb - ta;
      });
      return sorted[0];
    },

    async rewindLoop(state, reason) {
      state.loopNumber += 1;
      state.turnNumber = 1;
      state.loopEndMet = false;
      // 记录回溯
      state.rewindTable.push({
        loopNumber: state.loopNumber - 1,
        reason,
        ts: Date.now(),
        worldSnapshot: {
          location: state.locationTable[state.locationTable.length - 1],
          time: state.timeTable.currentTime,
        },
      });
      // 清空本次循环记忆表
      state.memoryTable = [];
      // 时间表重置
      state.timeTable = { currentTime: state.loopStartPoint || "" };
      // 人物表：本次循环交互重置，跨循环观察保留；charList 里的 char 默认仍在场
      for (const id in state.characterTable) {
        state.characterTable[id].loopInteraction = "";
        state.characterTable[id].present = true;
      }
      // 前两回合清空
      state.prevTurns = [];
      await this.saveState(state);
    },

    // 副2-总结：把指定主 API 输出应用到 state（记忆表/地点表/时间表/人物表/稳定线索/跨循环摘要）
    // 不调用死亡/破局判定。失败时调用方自行 try/catch
    async applySummary(state, modelOutput, roche) {
      const charList = await this.getCharList(state, roche);
      const presentChars = charList.filter(c => state.characterTable[c.id] && state.characterTable[c.id].present);
      const location = state.locationTable[state.locationTable.length - 1] || "";
      const time = state.timeTable.currentTime || "";

      const summaryMessages = Prompts.sub2Summary(modelOutput, state, state.mode, location, time, presentChars);
      const summary = await API.callSub2ForJSON(summaryMessages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber });

      if (summary.memoryEntry) {
        summary.memoryEntry.id = uid();
        state.memoryTable.push(summary.memoryEntry);
      }
      if (summary.newLocation) {
        if (!state.locationTable.find(l => l.name === summary.newLocation)) {
          state.locationTable.push({ name: summary.newLocation, description: "", crossLoopMemory: "", loopEvent: "" });
        }
      }
      if (summary.timeUpdate) {
        state.timeTable.currentTime = summary.timeUpdate;
      }
      if (summary.characterUpdates) {
        for (const cu of summary.characterUpdates) {
          for (const id in state.characterTable) {
            const c = state.characterTable[id];
            if (c.name === cu.name) {
              if (cu.loopInteraction) c.loopInteraction = (c.loopInteraction ? c.loopInteraction + "\n" : "") + cu.loopInteraction;
              if (cu.crossLoopObservation) c.crossLoopObservation = (c.crossLoopObservation ? c.crossLoopObservation + "\n" : "") + cu.crossLoopObservation;
            }
          }
        }
      }
      if (summary.stableClues && Array.isArray(summary.stableClues)) {
        for (const sc of summary.stableClues) {
          state.clueTable.push({
            id: uid(),
            summary: sc.summary || "",
            type: "stable",
            detail: sc.detail || "",
            fromLoop: state.loopNumber,
          });
        }
      }
      if (summary.crossLoopMemorySummary) {
        state.crossLoopMemory.push({
          id: uid(),
          summary: summary.crossLoopMemorySummary,
          loopNumber: state.loopNumber,
          turnNumber: state.turnNumber,
          type: "event",
        });
        state.clueTable.push({
          id: uid(),
          summary: summary.crossLoopMemorySummary,
          type: "event",
          detail: "",
          fromLoop: state.loopNumber,
        });
      }
      return summary;
    },

    // 从主 API 输出解析判定 JSON
    // 主 API 自判格式：【判定】\n{"death":{"died":false,"cause":"","details":""},"loopEndMet":false}
    _parseJudgeFromOutput(modelOutput) {
      const parsed = UI.parseJudge(modelOutput);
      if (parsed) return parsed;
      // 默认值：不死亡，未破局
      return { death: { died: false, cause: "", details: "" }, loopEndMet: false };
    },

    // 新流程：副2-总结（滞后）→ 副1（合并：种子+检索） → 主（自判） → 死亡/破局处理
    // a. 若 pendingMainOutput 非空：先调用 副2-总结 处理上一回合的输出
    // b. 第一回合（turnNumber===1 且 prevTurns 为空）跳过副1，用 baseScenarioSeed 作为种子
    // c. 否则调用 副1（sub1Turn）一次性返回 {seed, recallMemoryIds}，从 memoryTable 按 id 取原文
    // d. 主 API（流式可选）输出含思考/正文/选项/判定
    // e. 解析判定，处理死亡/破局
    async runTurn(state, userInput, usedClues, roche, onMainChunk) {
      // a. 处理上一回合的滞后总结
      if (state.pendingMainOutput) {
        try {
          await this.applySummary(state, state.pendingMainOutput, roche);
        } catch (e) {
          // 总结失败不阻塞主流程
        }
        state.pendingMainOutput = "";
      }

      // b/c. 副1 → 主
      const charList = await this.getCharList(state, roche);
      const presentChars = charList.filter(c => state.characterTable[c.id] && state.characterTable[c.id].present);
      const location = state.locationTable[state.locationTable.length - 1] || "";
      const time = state.timeTable.currentTime || "";

      let turnSeed = "";
      let recalledMemories = [];
      const isFirstTurn = state.turnNumber === 1 && state.prevTurns.length === 0;
      if (isFirstTurn) {
        // 第一回合：跳过副1，用 baseScenarioSeed 作为种子，无记忆可检索
        turnSeed = state.baseScenarioSeed || "";
      } else {
        const sub1Messages = Prompts.sub1Turn(
          userInput,
          usedClues,
          state.crossLoopMemory,
          state.baseWorldSetting,
          state.baseScenarioSeed,
          state.memoryTable,
          location,
          time,
          presentChars,
          state.mode,
          state.loopNumber
        );
        try {
          const sub1Result = await API.callSub1ForJSON(sub1Messages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber });
          turnSeed = sub1Result.seed || "";
          const ids = Array.isArray(sub1Result.recallMemoryIds) ? sub1Result.recallMemoryIds : [];
          // 按 id 从 memoryTable 取原文，跳过不存在的 id（幻觉处理）
          recalledMemories = ids
            .map(id => state.memoryTable.find(m => m.id === id))
            .filter(m => m && m.summary)
            .map(m => m.summary);
        } catch (e) {
          // 副1 失败：降级用基础种子，无检索记忆
          turnSeed = state.baseScenarioSeed || "";
        }
      }

      const injects = {
        baseWorldSetting: state.baseWorldSetting,
        turnSeed,
        style: state.style || "",
        person: state.person || "第三人称",
        userPersona: await this.getUserPersonaText(state, roche),
        charProfiles: presentChars,
        charDetails: presentChars.map(c => ({
          name: c.name,
          handle: c.handle,
          detailMemory: (state.characterTable[c.id] && (state.characterTable[c.id].loopInteraction + "\n" + state.characterTable[c.id].crossLoopObservation)) || "",
        })),
        recalledMemories,
        prevTurns: state.prevTurns.slice(-2).map(t => ({ userInput: t.userInput, modelOutput: UI.parseBody(t.modelOutput) })),
        userStats: {},
        standingOrders: state.standingOrders || [],
        modeRules: state.loopEndCondition ? "破局条件：" + state.loopEndCondition : "（隐藏条件）",
        userAction: userInput,
        usedClues,
      };
      state.lastInjects = injects;

      const mainMessages = Prompts.mainNarrate(injects);
      const settings = App.settings || DEFAULT_SETTINGS;
      let modelOutput;
      if (settings.streamEnabled) {
        modelOutput = await API.callStream("main", mainMessages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber }, onMainChunk);
      } else {
        modelOutput = await API.call("main", mainMessages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber });
      }

      // d. 从主 API 输出解析判定
      const judge = this._parseJudgeFromOutput(modelOutput);

      // e. 死亡 / 破局处理
      if (judge.death && judge.death.died) {
        state.deathTable.push({
          loopNumber: state.loopNumber,
          turnNumber: state.turnNumber,
          cause: judge.death.cause || "",
          details: judge.death.details || "",
          ts: Date.now(),
        });
        state.deathCount += 1;
        state.pendingMainOutput = ""; // 先清空，确保不会泄漏到下一回合
        // 死亡时先把本回合主输出交给 副2-总结 处理一次（跨循环摘要仍有价值），再回溯
        try {
          await this.applySummary(state, modelOutput, roche);
        } catch (e) {}
        state.pendingMainOutput = "";
        state.lastInjects = null;
        await this.rewindLoop(state, "死亡：" + (judge.death.cause || ""));
        await this.saveCurrent(state);
        return { modelOutput, judge, state, died: true };
      }

      if (typeof judge.loopEndMet === "boolean" && judge.loopEndMet) {
        state.loopEndMet = true;
        state.pendingMainOutput = modelOutput;
        // 破局：先把本回合主输出交给 副2-总结 处理
        try {
          await this.applySummary(state, modelOutput, roche);
        } catch (e) {}
        state.pendingMainOutput = "";
        // 前两回合更新
        state.prevTurns.push({ userInput, modelOutput });
        if (state.prevTurns.length > 2) state.prevTurns.shift();
        await this.saveCurrent(state);
        return { modelOutput, judge, state, broke: true };
      }

      // 既未死亡也未破局：设置 pendingMainOutput，等待下一回合开始时总结
      state.prevTurns.push({ userInput, modelOutput });
      if (state.prevTurns.length > 2) state.prevTurns.shift();
      state.pendingMainOutput = modelOutput;
      state.turnNumber += 1;
      await this.saveState(state);
      await this.saveCurrent(state);

      return { modelOutput, judge, state };
    },

    // 重 roll 主 API：用与上一次相同的 injects（同一回合种子和注入）重新调用主 API，
    // 然后从主 API 输出解析判定。不调用 副1，不调用 副2-总结。
    // 若判定死亡/破局则按 runTurn 同样逻辑处理（回溯/结局）。
    async rerollMain(state, userInput, usedClues, roche, onMainChunk) {
      if (!state.lastInjects) {
        throw new Error("无可重新生成的回合");
      }
      const injects = state.lastInjects;
      const mainMessages = Prompts.mainNarrate(injects);
      const settings = App.settings || DEFAULT_SETTINGS;
      let modelOutput;
      if (settings.streamEnabled) {
        modelOutput = await API.callStream("main", mainMessages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber }, onMainChunk);
      } else {
        modelOutput = await API.call("main", mainMessages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber });
      }

      // 从主 API 输出解析判定
      const judge = this._parseJudgeFromOutput(modelOutput);

      // 死亡处理
      if (judge.death && judge.death.died) {
        state.deathTable.push({
          loopNumber: state.loopNumber,
          turnNumber: state.turnNumber,
          cause: judge.death.cause || "",
          details: judge.death.details || "",
          ts: Date.now(),
        });
        state.deathCount += 1;
        state.pendingMainOutput = "";
        try {
          await this.applySummary(state, modelOutput, roche);
        } catch (e) {}
        state.pendingMainOutput = "";
        state.lastInjects = null;
        // 更新 prevTurns 的最后一项为重 roll 后的输出
        if (state.prevTurns.length > 0) {
          state.prevTurns[state.prevTurns.length - 1] = { userInput, modelOutput };
        }
        await this.rewindLoop(state, "死亡：" + (judge.death.cause || ""));
        await this.saveCurrent(state);
        return { modelOutput, judge, state, died: true };
      }

      // 破局处理
      if (typeof judge.loopEndMet === "boolean" && judge.loopEndMet) {
        state.loopEndMet = true;
        state.pendingMainOutput = modelOutput;
        try {
          await this.applySummary(state, modelOutput, roche);
        } catch (e) {}
        state.pendingMainOutput = "";
        if (state.prevTurns.length > 0) {
          state.prevTurns[state.prevTurns.length - 1] = { userInput, modelOutput };
        }
        await this.saveCurrent(state);
        return { modelOutput, judge, state, broke: true };
      }

      // 正常：更新 pendingMainOutput 为新输出，不调用 副2-总结
      state.pendingMainOutput = modelOutput;
      if (state.prevTurns.length > 0) {
        state.prevTurns[state.prevTurns.length - 1] = { userInput, modelOutput };
      }
      await this.saveCurrent(state);
      return { modelOutput, judge, state };
    },

    async getCharList(state, roche) {
      try {
        const all = await roche.character.list();
        return (all || []).filter(c => state.charIds.includes(c.id));
      } catch (e) {
        return [];
      }
    },

    async getUserPersonaText(state, roche) {
      try {
        if (!state.userPersonaId) return "";
        const users = await roche.persona.getUserPersonas();
        const u = (users || []).find(x => x.id === state.userPersonaId);
        return (u && (u.persona || u.bio)) || "";
      } catch (e) {
        return "";
      }
    },

    async runEnding(state, roche) {
      // 破局结局：副 API 1 总结 char 每次循环记忆
      const charList = await this.getCharList(state, roche);
      const charMems = charList.map(c => ({
        name: c.name,
        handle: c.handle,
        crossLoopObservation: (state.characterTable[c.id] && state.characterTable[c.id].crossLoopObservation) || "",
      }));
      const userPersona = await this.getUserPersonaText(state, roche);
      const messages = Prompts.sub1Ending(charMems, userPersona, state.mode);
      const ending = await API.callWithRetry("sub1", messages, { loopNumber: state.loopNumber, turnNumber: state.turnNumber });
      return ending;
    },
  };

  // ============================================================
  // UI 渲染
  // ============================================================
  const UI = {
    render() {
      const { route } = App;
      const root = App.root;
      if (!root) return;
      App.applyTheme();
      root.replaceChildren();

      // 顶栏
      const topbar = el("div", { class: "tlg-topbar" });
      // 内容
      const content = el("div", { class: "tlg-scroll" });
      const contentInner = el("div", { class: "tlg-content" });

      let title = "时间循环文游";
      let showBack = false;
      let showMenu = false;

      if (route === "home") {
        title = "选择三种命运";
        contentInner.appendChild(this.renderHome());
      } else if (route === "create") {
        title = "创建存档";
        showBack = true;
        contentInner.appendChild(this.renderCreate(App.routeData));
      } else if (route === "game") {
        title = MODE_LABEL[App.state && App.state.mode] || "游戏中";
        showBack = true;
        showMenu = true;
        contentInner.appendChild(this.renderGame());
      } else if (route === "settings") {
        title = "设置";
        showBack = true;
        contentInner.appendChild(this.renderSettings());
      } else if (route === "logs") {
        title = "系统日志";
        showBack = true;
        contentInner.appendChild(this.renderLogs());
      }

      if (showBack) {
        topbar.appendChild(el("button", { class: "tlg-icon-btn", onclick: () => App.goBack() },
          el("span", { innerHTML: svgIcon("back", 20) })));
      }
      topbar.appendChild(el("div", { class: "tlg-title" }, title));
      topbar.appendChild(el("button", { class: "tlg-icon-btn", onclick: () => App.navigate("settings") },
        el("span", { innerHTML: svgIcon("settings", 20) })));
      topbar.appendChild(el("button", { class: "tlg-icon-btn", onclick: () => { try { window.Roche.ui.closeApp(); } catch(e){} } },
        el("span", { innerHTML: svgIcon("close", 20) })));

      content.appendChild(contentInner);

      // 状态栏（游戏中）
      let statusBar = null;
      if (route === "game" && App.state) {
        statusBar = el("div", { class: "tlg-status-bar" },
          el("span", null, "第 " + App.state.loopNumber + " 次循环"),
          el("span", null, "第 " + App.state.turnNumber + " 回合"),
          el("span", null, "死亡 " + App.state.deathCount + " 次")
        );
      }

      // 侧边栏（游戏中）
      let sidebar = null;
      let sidebarOverlay = null;
      if (route === "game") {
        sidebarOverlay = el("div", { class: "tlg-sidebar-overlay", onclick: () => App.root.classList.remove("sidebar-open") });
        sidebar = this.renderSidebar();
      }

      root.appendChild(topbar);
      root.appendChild(content);
      if (statusBar) root.appendChild(statusBar);
      if (sidebarOverlay) root.appendChild(sidebarOverlay);
      if (sidebar) root.appendChild(sidebar);

      // 悬浮球（有存档时显示）
      if (App.state) {
        root.appendChild(this.renderFab());
      }
    },

    renderHome() {
      const wrap = el("div", null);
      const cards = [
        { mode: MODE.GROUNDHOG, title: "土拨鼠之日", desc: "重复的一天。改变自己，打破循环。欢快温暖。", icon: "clock" },
        { mode: MODE.HAPPY_DEATH, title: "忌日快乐", desc: "今天你会死。找到真相，否则永远循环。惊悚暗黑。", icon: "skull" },
        { mode: MODE.EDGE_TOMORROW, title: "明日边缘", desc: "不可能的任务。死亡是超能力。硬核冷峻。", icon: "play" },
      ];
      wrap.appendChild(el("div", { class: "tlg-faded tlg-mb-16" }, "选择你的命运"));
      cards.forEach(c => {
        const card = el("div", { class: "tlg-card", onclick: () => App.navigate("create", { mode: c.mode }) },
          el("div", { class: "tlg-row tlg-gap-8 tlg-mb-8" },
            el("span", { innerHTML: svgIcon(c.icon, 28) }),
            el("div", { style: "font-size:18px;font-weight:600;" }, c.title)
          ),
          el("div", { class: "tlg-faded" }, c.desc)
        );
        card.style.cursor = "pointer";
        wrap.appendChild(card);
      });

      // 继续上一次游戏（取 saves 数组最近一个存档）
      wrap.appendChild(el("div", { class: "tlg-divider" }));
      const cont = el("button", { class: "tlg-btn tlg-btn-ghost tlg-mt-8", onclick: async () => {
        const latest = await Engine.getLatestSave();
        if (latest) {
          const state = await Engine.loadSave(latest.id);
          if (state) {
            App.state = state;
            App.setMode(state.mode);
            App.navigate("game");
          } else {
            window.Roche.ui.toast("存档加载失败");
          }
        } else {
          window.Roche.ui.toast("没有存档");
        }
      } }, "继续上一次游戏");
      wrap.appendChild(cont);

      // 存档列表
      wrap.appendChild(el("div", { class: "tlg-label tlg-mt-16" }, "存档列表"));
      const savesBox = el("div", { class: "tlg-mb-16" });
      wrap.appendChild(savesBox);
      savesBox.appendChild(el("div", { class: "tlg-empty" }, "加载中..."));

      // 异步加载存档列表
      Engine.getAllSaves().then(saves => {
        const self = this;
        savesBox.replaceChildren();
        if (!saves || !saves.length) {
          savesBox.appendChild(el("div", { class: "tlg-empty" }, "暂无存档"));
          return;
        }
        const sorted = saves.slice().sort((a, b) => {
          const ta = a.updatedAt || a.createdAt || 0;
          const tb = b.updatedAt || b.createdAt || 0;
          return tb - ta;
        });
        sorted.forEach(save => {
          const card = el("div", { class: "tlg-card" },
            el("div", { class: "tlg-row", style: "justify-content:space-between;align-items:flex-start;" },
              el("div", { style: "font-weight:600;flex:1;word-break:break-word;" }, save.name || "未命名存档"),
              el("span", { class: "tlg-tag" }, MODE_LABEL[save.mode] || save.mode || "")
            ),
            el("div", { class: "tlg-faded tlg-mt-8" },
              "第" + save.loopNumber + "次循环 · 第" + save.turnNumber + "回合 · 死亡" + save.deathCount + "次"
            ),
            el("div", { class: "tlg-faded" },
              save.createdAt ? new Date(save.createdAt).toLocaleString() : ""
            ),
            el("div", { class: "tlg-row tlg-mt-8 tlg-gap-8" },
              el("button", { class: "tlg-btn-ghost", onclick: async () => {
                const state = await Engine.loadSave(save.id);
                if (state) {
                  App.state = state;
                  App.setMode(state.mode);
                  App.navigate("game");
                } else {
                  window.Roche.ui.toast("存档加载失败");
                }
              } }, "加载"),
              el("button", { class: "tlg-btn-ghost", onclick: async () => {
                const ok = await window.Roche.ui.confirm({
                  title: "删除存档",
                  message: "确定删除存档「" + (save.name || "") + "」？此操作不可撤销。"
                });
                if (!ok) return;
                await Engine.deleteSave(save.id);
                self.render();
              } }, "删除")
            )
          );
          savesBox.appendChild(card);
        });
      });

      return wrap;
    },

    renderCreate(data) {
      const mode = (data && data.mode) || MODE.GROUNDHOG;
      App.setMode(mode);
      const wrap = el("div", null);
      const state = {
        mode,
        userPersona: null,
        charList: [],
        task: "",
        worldview: "",
        style: "",
        standingOrders: [],
        person: "第三人称", // 默认第三人称
      };

      // user 人设选择
      wrap.appendChild(el("div", { class: "tlg-label" }, "选择 user 人设"));
      const userSel = el("select", { class: "tlg-select tlg-mb-16" });
      userSel.appendChild(el("option", { value: "" }, "未选择"));
      wrap.appendChild(userSel);

      // char 选择（多选）
      wrap.appendChild(el("div", { class: "tlg-label" }, "选择 char 人设（可多选）"));
      const charBox = el("div", { class: "tlg-mb-16" });
      const charCheckboxes = [];
      wrap.appendChild(charBox);

      // 人称选择
      wrap.appendChild(el("div", { class: "tlg-label" }, "人称"));
      const personRow = el("div", { class: "tlg-row tlg-gap-8 tlg-mb-16" });
      const personThird = el("label", { class: "tlg-card", style: "display:flex;align-items:center;gap:8px;cursor:pointer;margin:0;flex:1;" },
        el("input", { type: "radio", name: "tlg-person", value: "第三人称", checked: true, style: "width:auto;" }),
        el("span", null, "第三人称")
      );
      const personSecond = el("label", { class: "tlg-card", style: "display:flex;align-items:center;gap:8px;cursor:pointer;margin:0;flex:1;" },
        el("input", { type: "radio", name: "tlg-person", value: "第二人称", style: "width:auto;" }),
        el("span", null, "第二人称")
      );
      personThird.querySelector("input").addEventListener("change", (e) => { if (e.target.checked) state.person = "第三人称"; });
      personSecond.querySelector("input").addEventListener("change", (e) => { if (e.target.checked) state.person = "第二人称"; });
      personRow.appendChild(personThird);
      personRow.appendChild(personSecond);
      wrap.appendChild(personRow);

      // 任务（土拨鼠/明日边缘可选）
      if (mode !== MODE.HAPPY_DEATH) {
        wrap.appendChild(el("div", { class: "tlg-label" }, "任务（可选）"));
        const taskInput = el("input", { class: "tlg-input tlg-mb-16", placeholder: "如：让所有人度过完美一天" });
        taskInput.addEventListener("input", () => state.task = taskInput.value);
        wrap.appendChild(taskInput);
      }

      // 世界观
      wrap.appendChild(el("div", { class: "tlg-label" }, "世界观（手动输入或导入文件）"));
      const worldTextarea = el("textarea", { class: "tlg-textarea", placeholder: "输入世界观，或点击下方导入 txt/docx" });
      worldTextarea.addEventListener("input", () => state.worldview = worldTextarea.value);
      wrap.appendChild(worldTextarea);

      // 文件导入
      const fileInput = el("input", { type: "file", accept: ".txt,.docx,.md", style: "display:none;" });
      const importBtn = el("button", { class: "tlg-btn-ghost tlg-mt-8", onclick: () => fileInput.click() }, "导入文件");
      fileInput.addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          let text = "";
          if (f.name.endsWith(".txt") || f.name.endsWith(".md")) {
            text = await f.text();
          } else {
            // docx 简易处理：尝试 text()
            text = await f.text();
          }
          worldTextarea.value = text;
          state.worldview = text;
          window.Roche.ui.toast("导入成功");
        } catch (err) {
          window.Roche.ui.toast("导入失败");
        }
      });
      wrap.appendChild(fileInput);
      wrap.appendChild(importBtn);

      // 文风
      wrap.appendChild(el("div", { class: "tlg-label tlg-mt-16" }, "文风"));
      const styleTextarea = el("textarea", { class: "tlg-textarea", placeholder: "第三人称，细腻心理描写，悬疑氛围" });
      styleTextarea.addEventListener("input", () => { state.style = styleTextarea.value; });
      wrap.appendChild(styleTextarea);

      // 常驻指令
      wrap.appendChild(el("div", { class: "tlg-label tlg-mt-16" }, "常驻指令（每行一条）"));
      const standingTextarea = el("textarea", { class: "tlg-textarea", placeholder: "每行一条，如：保持角色神秘感 / 每回合提供2-4个选项" });
      standingTextarea.addEventListener("input", () => {
        state.standingOrders = standingTextarea.value.split("\n").map(s => s.trim()).filter(Boolean);
      });
      wrap.appendChild(standingTextarea);

      // 确认按钮
      const createBtn = el("button", { class: "tlg-btn tlg-mt-16", style: "width:100%;" }, "创建存档并开始");
      createBtn.disabled = true;
      wrap.appendChild(createBtn);

      // 加载 Roche 数据
      (async () => {
        try {
          const users = await window.Roche.persona.getUserPersonas();
          (users || []).forEach(u => {
            userSel.appendChild(el("option", { value: u.id }, u.handle || u.name || "未命名"));
          });
          userSel.addEventListener("change", () => {
            const u = (users || []).find(x => x.id === userSel.value);
            state.userPersona = u || null;
            checkReady();
          });
        } catch (e) {}

        try {
          const chars = await window.Roche.character.list();
          (chars || []).forEach(c => {
            const cb = el("label", { class: "tlg-card", style: "display:block;cursor:pointer;margin-bottom:8px;" },
              el("div", { class: "tlg-row tlg-gap-8" },
                el("input", { type: "checkbox", value: c.id, style: "width:auto;" }),
                el("div", null, c.handle || c.name || "未命名")
              )
            );
            const checkbox = cb.querySelector("input");
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                if (!state.charList.find(x => x.id === c.id)) state.charList.push(c);
              } else {
                state.charList = state.charList.filter(x => x.id !== c.id);
              }
              checkReady();
            });
            charCheckboxes.push(cb);
            charBox.appendChild(cb);
          });
        } catch (e) {}

        function checkReady() {
          createBtn.disabled = !(state.userPersona && state.charList.length > 0);
        }
      })();

      createBtn.addEventListener("click", async () => {
        createBtn.disabled = true;
        createBtn.textContent = "生成世界设定中...";
        try {
          // 1. 主 API 生成基础世界设定 + 开场序幕（一次性输出两部分）
          const worldMessages = Prompts.mainCreateWorld(mode, state.userPersona && (state.userPersona.persona || state.userPersona.bio), state.charList, state.task, state.worldview, state.person);
          const worldOutput = await API.call("main", worldMessages, {});

          // 解析【世界设定】和【开场序幕】
          let baseWorldSetting = worldOutput;
          let openingScene = "";
          const wsIdx = worldOutput.indexOf("【世界设定】");
          const osIdx = worldOutput.indexOf("【开场序幕】");
          if (wsIdx >= 0 && osIdx >= 0 && osIdx > wsIdx) {
            baseWorldSetting = worldOutput.slice(wsIdx + "【世界设定】".length, osIdx).trim();
            openingScene = worldOutput.slice(osIdx + "【开场序幕】".length).trim();
          } else if (wsIdx >= 0) {
            baseWorldSetting = worldOutput.slice(wsIdx + "【世界设定】".length).trim();
          } else if (osIdx >= 0) {
            openingScene = worldOutput.slice(osIdx + "【开场序幕】".length).trim();
          }

          // 2. 副 API 生成基础剧本种子
          const seedMessages = Prompts.subCreateSeed(baseWorldSetting, mode, state.charList);
          const baseSeed = await API.callWithRetry("sub1", seedMessages, {});

          // 3. 初始化状态（含 person 与 openingScene）
          App.state = await Engine.initState(mode, state.userPersona, state.charList, state.task, baseWorldSetting, baseSeed, state.style, state.standingOrders, state.person, openingScene);
          App.state.loopStartPoint = "循环起点";
          // 写入 saves 数组（初始存档）
          await Engine.saveCurrent(App.state);

          // 4. 进入游戏
          App.navigate("game");
          window.Roche.ui.toast("存档创建成功");
        } catch (e) {
          window.Roche.ui.toast("创建失败：" + (e.message || "未知错误"));
          createBtn.disabled = false;
          createBtn.textContent = "创建存档并开始";
        }
      });

      return wrap;
    },

    renderGame() {
      const wrap = el("div", null);
      const state = App.state;
      if (!state) {
        wrap.appendChild(el("div", { class: "tlg-empty" }, "无存档"));
        return wrap;
      }

      // 判断是否为第一回合（开场序幕阶段）
      const isFirstTurn = state.turnNumber === 1 && state.prevTurns.length === 0;

      // 剧情显示区
      const storyArea = el("div", { class: "tlg-prose tlg-mb-16", id: "tlg-story" });
      if (isFirstTurn && state.openingScene) {
        storyArea.textContent = state.openingScene;
      } else {
        storyArea.textContent = "输入你的行动开始剧情...";
      }
      wrap.appendChild(storyArea);

      // 选项区
      const optionsArea = el("div", { id: "tlg-options" });
      wrap.appendChild(optionsArea);

      // 重新生成本回合按钮（仅在本回合已生成输出且未死亡未破局时显示）
      const rerollBtn = el("button", { class: "tlg-btn-ghost tlg-mt-8", style: "display:none;" },
        el("span", { innerHTML: svgIcon("refresh", 16) }),
        " 重新生成本回合"
      );
      wrap.appendChild(rerollBtn);

      // 已选线索展示
      const usedCluesArea = el("div", { id: "tlg-used-clues", class: "tlg-mb-8" });
      wrap.appendChild(usedCluesArea);

      // 输入区
      const inputArea = el("div", null);
      const actionInput = el("textarea", { class: "tlg-input", id: "tlg-action-input", placeholder: "输入你的行动...", style: "min-height:60px;resize:vertical;font-family:inherit;" });
      inputArea.appendChild(actionInput);
      const sendBtn = el("button", { class: "tlg-btn tlg-mt-8", style: "width:100%;" }, "行动");
      inputArea.appendChild(sendBtn);
      wrap.appendChild(inputArea);

      // 快捷操作
      const quickBar = el("div", { class: "tlg-row tlg-row-wrap tlg-gap-8 tlg-mt-8" },
        el("button", { class: "tlg-btn-ghost", onclick: () => App.root.classList.add("sidebar-open") }, "侧边栏"),
        el("button", { class: "tlg-btn-ghost", onclick: () => this.showCluePicker() }, "使用线索")
      );
      wrap.appendChild(quickBar);

      const usedClues = [];
      // 记录当前回合的输入与线索（供 reroll 使用）
      let lastTurnInput = null;

      // 渲染主 API 输出（正文 + 选项 + 思维链折叠）
      const renderOutput = (modelOutput) => {
        const body = this.parseBody(modelOutput);
        const thinking = this.parseThinking(modelOutput);
        const options = this.parseOptions(modelOutput);
        storyArea.innerHTML = "";
        // 思维链默认折叠
        if (thinking) {
          const toggle = el("div", { class: "tlg-thinking-toggle" }, "[显示思考]");
          let expanded = false;
          const thinkingBody = el("div", { class: "tlg-thinking-body", style: "display:none;" }, thinking);
          toggle.addEventListener("click", () => {
            expanded = !expanded;
            toggle.textContent = expanded ? "[隐藏思考]" : "[显示思考]";
            thinkingBody.style.display = expanded ? "block" : "none";
          });
          storyArea.appendChild(toggle);
          storyArea.appendChild(thinkingBody);
        }
        storyArea.appendChild(document.createTextNode(body));
        optionsArea.replaceChildren();
        if (options && options.length) {
          options.forEach(opt => {
            const btn = el("button", { class: "tlg-option-btn", onclick: () => {
              const inp = document.getElementById("tlg-action-input");
              if (inp) {
                const cur = inp.value;
                if (cur && cur.trim()) {
                  inp.value = cur.replace(/\s+$/, "") + "\n" + opt;
                } else {
                  inp.value = opt;
                }
              }
              btn.classList.add("used");
            } }, opt);
            optionsArea.appendChild(btn);
          });
        }
      };

      sendBtn.addEventListener("click", async () => {
        const input = document.getElementById("tlg-action-input");
        const action = input.value.trim();
        if (!action) return;
        sendBtn.disabled = true;
        sendBtn.textContent = "推进中...";
        storyArea.textContent = "正在推进剧情...";
        optionsArea.replaceChildren();
        rerollBtn.style.display = "none";
        lastTurnInput = null;

        // 从 showCluePicker 同步已选线索
        if (window.__tlgUsedClues && window.__tlgUsedClues.length) {
          usedClues.length = 0;
          window.__tlgUsedClues.forEach(c => usedClues.push(c));
        }
        // 捕获本次输入与线索，供 reroll 使用
        const capturedAction = action;
        const capturedClues = usedClues.slice();

        // 流式回调：实时显示完整原始输出（含【思考】等标记），完成后由 renderOutput 分离
        const onMainChunk = (chunk, fullText) => {
          storyArea.textContent = fullText;
        };

        try {
          const result = await Engine.runTurn(state, action, capturedClues, App.roche, onMainChunk);
          renderOutput(result.modelOutput);
          usedClues.length = 0;
          window.__tlgUsedClues = [];
          this.renderUsedClues(usedCluesArea, usedClues);

          // 死亡：runTurn 内部已处理 rewindLoop
          if (result.died) {
            window.Roche.ui.toast("user 死亡，触发回溯");
            rerollBtn.style.display = "none";
            lastTurnInput = null;
            App.state = state;
            // 死亡剧情已在 storyArea 显示，追加"回溯到循环开始"按钮，点击后刷新界面
            storyArea.appendChild(el("div", { class: "tlg-divider" }));
            storyArea.appendChild(el("button", {
              class: "tlg-btn tlg-mt-16",
              onclick: () => {
                App.state = state;
                UI.render();
              }
            }, "回溯到循环开始"));
            return;
          }
          // 破局：runTurn 内部已处理总结，这里只生成结局
          if (result.broke) {
            rerollBtn.style.display = "none";
            lastTurnInput = null;
            storyArea.appendChild(el("div", { class: "tlg-divider" }));
            storyArea.appendChild(el("div", { class: "tlg-faded" }, "破局成功，生成结局中..."));
            try {
              const ending = await Engine.runEnding(state, App.roche);
              storyArea.appendChild(el("div", { class: "tlg-prose tlg-mt-16" }, ending));
            } catch (e2) {
              storyArea.appendChild(el("div", { class: "tlg-faded" }, "结局生成失败：" + (e2.message || "")));
            }
            App.state = state;
            return;
          }
          // 正常：显示重新生成按钮
          lastTurnInput = { action: capturedAction, usedClues: capturedClues };
          rerollBtn.style.display = "";
          App.state = state;
        } catch (e) {
          window.Roche.ui.toast("出错：" + (e.message || "未知错误"));
          storyArea.textContent = "出错，请重试。";
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = "行动";
        }
      });

      // 重新生成本回合：用同一回合种子和注入重新调用主 API，立即做判定
      rerollBtn.addEventListener("click", async () => {
        if (!lastTurnInput) return;
        rerollBtn.disabled = true;
        const prevText = rerollBtn.innerHTML;
        rerollBtn.innerHTML = "重新生成中...";
        storyArea.textContent = "正在重新生成...";
        optionsArea.replaceChildren();
        const onMainChunk = (chunk, fullText) => {
          storyArea.textContent = fullText;
        };
        try {
          const result = await Engine.rerollMain(state, lastTurnInput.action, lastTurnInput.usedClues, App.roche, onMainChunk);
          renderOutput(result.modelOutput);

          if (result.died) {
            window.Roche.ui.toast("user 死亡，触发回溯");
            rerollBtn.style.display = "none";
            lastTurnInput = null;
            App.state = state;
            // 死亡剧情已在 storyArea 显示，追加"回溯到循环开始"按钮，点击后刷新界面
            storyArea.appendChild(el("div", { class: "tlg-divider" }));
            storyArea.appendChild(el("button", {
              class: "tlg-btn tlg-mt-16",
              onclick: () => {
                App.state = state;
                UI.render();
              }
            }, "回溯到循环开始"));
            return;
          }
          if (result.broke) {
            rerollBtn.style.display = "none";
            lastTurnInput = null;
            storyArea.appendChild(el("div", { class: "tlg-divider" }));
            storyArea.appendChild(el("div", { class: "tlg-faded" }, "破局成功，生成结局中..."));
            try {
              const ending = await Engine.runEnding(state, App.roche);
              storyArea.appendChild(el("div", { class: "tlg-prose tlg-mt-16" }, ending));
            } catch (e2) {
              storyArea.appendChild(el("div", { class: "tlg-faded" }, "结局生成失败：" + (e2.message || "")));
            }
            App.state = state;
            return;
          }
          // 正常：保留 lastTurnInput（仍可再次重 roll），rerollBtn 保持显示
          App.state = state;
        } catch (e) {
          window.Roche.ui.toast("出错：" + (e.message || "未知错误"));
          storyArea.textContent = "出错，请重试。";
        } finally {
          rerollBtn.disabled = false;
          rerollBtn.innerHTML = prevText;
        }
      });

      return wrap;
    },

    parseModelOutput(text) {
      const parts = { body: text, options: [] };
      if (!text) return parts;
      // 优先识别 【正文】 / 【选项】 标记
      const bodyStart = text.indexOf("【正文】");
      const optIdx = text.indexOf("【选项】");
      if (optIdx >= 0) {
        parts.body = (bodyStart >= 0 ? text.slice(bodyStart + "【正文】".length, optIdx) : text.slice(0, optIdx)).trim();
        return parts;
      }
      // 兼容 --- 分隔
      const m = text.split(/---\n?/);
      if (m.length > 1) {
        parts.body = m[0].trim();
        const optText = m.slice(1).join("---").trim();
        const lines = optText.split("\n").map(l => l.trim()).filter(Boolean);
        const opts = [];
        for (const line of lines) {
          const om = line.match(/^(?:选项\d+[:：]?|\d+[.、])?\s*(.+)/);
          if (om && om[1]) opts.push(om[1]);
        }
        parts.options = opts;
      }
      return parts;
    },

    // 解析主 API 输出中的【思考】部分（在【思考】和【正文】之间）
    parseThinking(text) {
      if (!text) return "";
      const start = text.indexOf("【思考】");
      if (start < 0) return "";
      const bodyStart = text.indexOf("【正文】", start);
      if (bodyStart < 0) return "";
      return text.slice(start + "【思考】".length, bodyStart).trim();
    },

    // 解析主 API 输出中的【正文】部分（在【正文】和【选项】之间）
    parseBody(text) {
      if (!text) return "";
      const start = text.indexOf("【正文】");
      if (start < 0) {
        // 兼容无标记的旧格式：取到【选项】或【判定】之前
        const optIdx = text.indexOf("【选项】");
        const judgeIdx = text.indexOf("【判定】");
        let end = text.length;
        if (optIdx >= 0) end = optIdx;
        if (judgeIdx >= 0 && judgeIdx < end) end = judgeIdx;
        return text.slice(0, end).trim();
      }
      const optIdx = text.indexOf("【选项】", start);
      const judgeIdx = text.indexOf("【判定】", start);
      let end = text.length;
      if (optIdx >= 0) end = optIdx;
      if (judgeIdx >= 0 && judgeIdx < end) end = judgeIdx;
      return text.slice(start + "【正文】".length, end).trim();
    },

    // 解析主 API 输出中的【判定】部分，返回 JSON 对象；解析失败返回 null
    parseJudge(text) {
      if (!text) return null;
      const idx = text.indexOf("【判定】");
      if (idx < 0) return null;
      const judgeText = text.slice(idx + "【判定】".length);
      return API._tryParseJSON(judgeText);
    },

    // 解析主 API 输出中的【选项】部分，返回选项数组（在【选项】和【判定】之间）
    parseOptions(text) {
      if (!text) return [];
      const idx = text.indexOf("【选项】");
      if (idx < 0) return [];
      let optText = text.slice(idx + "【选项】".length);
      // 在【判定】处截断
      const judgeIdx = optText.indexOf("【判定】");
      if (judgeIdx >= 0) optText = optText.slice(0, judgeIdx);
      const lines = optText.split("\n").map(l => l.trim()).filter(Boolean);
      const opts = [];
      for (const line of lines) {
        const om = line.match(/^\d+[.、)]\s*(.+)/);
        if (om && om[1]) opts.push(om[1]);
        else opts.push(line);
      }
      return opts;
    },

    showCluePicker() {
      const state = App.state;
      if (!state || !state.clueTable.length) {
        window.Roche.ui.toast("暂无线索");
        return;
      }
      const overlay = el("div", { style: "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;" });
      const dialog = el("div", { class: "tlg-card", style: "max-height:70vh;overflow-y:auto;width:100%;max-width:500px;" },
        el("div", { class: "tlg-row", style: "justify-content:space-between;margin-bottom:12px;" },
          el("div", { style: "font-size:16px;font-weight:600;" }, "选择线索使用"),
          el("button", { class: "tlg-icon-btn", onclick: () => overlay.remove() }, el("span", { innerHTML: svgIcon("close", 20) }))
        )
      );
      const usedCluesArea = document.getElementById("tlg-used-clues");
      let usedClues = [];

      state.clueTable.forEach((clue, i) => {
        const card = el("div", { class: "tlg-clue-card", onclick: () => {
          if (usedClues.find(c => c.id === clue.id)) {
            usedClues = usedClues.filter(c => c.id !== clue.id);
            card.classList.remove("selected");
          } else {
            usedClues.push(clue);
            card.classList.add("selected");
          }
        } },
          el("div", { class: "tlg-row", style: "justify-content:space-between;" },
            el("span", { class: "tlg-tag tlg-tag-" + clue.type }, clue.type === "stable" ? "稳定" : clue.type === "death" ? "死因" : clue.type === "location" ? "地点" : "事件"),
            el("span", { class: "tlg-faded" }, "第" + (clue.fromLoop || "?") + "次循环")
          ),
          el("div", { class: "tlg-mt-8" }, clue.summary || clue.text || "")
        );
        dialog.appendChild(card);
      });

      const confirmBtn = el("button", { class: "tlg-btn tlg-mt-16", style: "width:100%;", onclick: () => {
        // 写入 usedCluesArea
        usedCluesArea.replaceChildren();
        usedClues.forEach(c => {
          usedCluesArea.appendChild(el("div", { class: "tlg-tag tlg-tag-" + c.type }, c.summary || c.text || ""));
        });
        // 存到全局
        window.__tlgUsedClues = usedClues;
        overlay.remove();
      } }, "确认使用");
      dialog.appendChild(confirmBtn);

      overlay.appendChild(dialog);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      App.root.appendChild(overlay);
    },

    renderUsedClues(area, usedClues) {
      area.replaceChildren();
      usedClues.forEach(c => {
        area.appendChild(el("div", { class: "tlg-tag tlg-tag-" + c.type }, c.summary || c.text || ""));
      });
    },

    // 悬浮球 + 菜单 + 悬浮小窗
    renderFab() {
      const wrap = el("div", null);
      // 悬浮球按钮
      const fab = el("button", { class: "tlg-fab", onclick: () => {
        App.fabOpen = !App.fabOpen;
        UI.render();
      } }, el("span", { innerHTML: svgIcon("menu", 24) }));
      wrap.appendChild(fab);

      // 菜单（仅当 fabOpen 且没有打开小窗时）
      if (App.fabOpen && !App.fabPanel) {
        const menu = el("div", { class: "tlg-fab-menu" });
        const items = [
          { key: "logs", label: "系统日志" },
          { key: "memory", label: "记忆表" },
          { key: "location", label: "地点表" },
          { key: "time", label: "时间表" },
          { key: "character", label: "人物表" },
          { key: "death", label: "死亡记录" },
          { key: "clue", label: "线索表" },
          { key: "rewind", label: "回溯记录" },
        ];
        items.forEach(item => {
          menu.appendChild(el("button", { onclick: () => {
            App.fabPanel = item.key;
            App.fabOpen = false;
            UI.render();
          } }, item.label));
        });
        wrap.appendChild(menu);
      }

      // 悬浮小窗
      if (App.fabPanel) {
        wrap.appendChild(this.renderFabPanel(App.fabPanel));
      }
      return wrap;
    },

    renderFabPanel(type) {
      const state = App.state;
      const titles = {
        logs: "系统日志",
        memory: "记忆表",
        location: "地点表",
        time: "时间表",
        character: "人物表",
        death: "死亡记录",
        clue: "线索表",
        rewind: "回溯记录",
      };
      const panel = el("div", { class: "tlg-fab-panel" },
        el("div", { class: "tlg-fab-panel-head" },
          el("div", null, titles[type] || "面板"),
          el("button", { class: "tlg-icon-btn", onclick: () => {
            App.fabPanel = null;
            UI.render();
          } }, el("span", { innerHTML: svgIcon("close", 20) }))
        ),
        el("div", { class: "tlg-fab-panel-body" })
      );
      const body = panel.querySelector(".tlg-fab-panel-body");

      if (!state) {
        body.appendChild(el("div", { class: "tlg-empty" }, "无存档"));
        return panel;
      }

      if (type === "logs") {
        body.appendChild(el("div", { class: "tlg-empty" }, "加载中..."));
        Logger.getAll().then(logs => {
          body.replaceChildren();
          if (!logs || !logs.length) {
            body.appendChild(el("div", { class: "tlg-empty" }, "暂无日志"));
            return;
          }
          logs.slice(0, 50).forEach(log => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                el("span", { class: "tlg-tag" }, log.role === "main" ? "主" : log.role === "sub1" ? "副1" : "副2"),
                el("span", { class: "tlg-faded" }, new Date(log.ts).toLocaleString() + (log.loopNumber ? " L" + log.loopNumber : "") + (log.turnNumber ? " T" + log.turnNumber : ""))
              ),
              el("div", { class: "tlg-faded tlg-mt-8", style: "font-size:12px;white-space:pre-wrap;max-height:150px;overflow-y:auto;" }, log.reply || "")
            ));
          });
        });
      } else if (type === "memory") {
        if (!state.memoryTable || !state.memoryTable.length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          state.memoryTable.forEach(m => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                el("span", { class: "tlg-faded" }, (m.time || "") + " · " + (m.location || "")),
                el("span", { class: "tlg-tag" }, "id: " + (m.id || "(无)"))
              ),
              el("div", { class: "tlg-mt-8" }, m.summary || ""),
              m.characters && m.characters.length ? el("div", { class: "tlg-faded tlg-mt-8" }, "涉及：" + m.characters.join("、")) : null
            ));
          });
        }
      } else if (type === "location") {
        if (!state.locationTable || !state.locationTable.length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          state.locationTable.forEach(loc => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { style: "font-weight:600;" }, loc.name || "未命名"),
              loc.description ? el("div", { class: "tlg-faded tlg-mt-8" }, loc.description) : null,
              loc.crossLoopMemory ? el("div", { class: "tlg-mt-8" }, loc.crossLoopMemory) : null
            ));
          });
        }
      } else if (type === "time") {
        if (!state.timeTable) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          body.appendChild(el("div", { class: "tlg-card" },
            el("div", { style: "font-weight:600;" }, "当前时间"),
            el("div", { class: "tlg-mt-8" }, state.timeTable.currentTime || "（未指定）")
          ));
        }
      } else if (type === "character") {
        if (!state.characterTable || !Object.keys(state.characterTable).length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          for (const id in state.characterTable) {
            const c = state.characterTable[id];
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                el("div", { style: "font-weight:600;" }, c.name || c.handle || "未命名"),
                el("span", { class: "tlg-tag" + (c.present ? "" : " tlg-faded") }, c.present ? "在场" : "退场")
              ),
              c.loopInteraction ? el("div", { class: "tlg-faded tlg-mt-8" }, "本次循环：" + c.loopInteraction) : null,
              c.crossLoopObservation ? el("div", { class: "tlg-faded tlg-mt-8" }, "跨循环：" + c.crossLoopObservation) : null
            ));
          }
        }
      } else if (type === "death") {
        if (!state.deathTable || !state.deathTable.length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          state.deathTable.forEach(d => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-faded tlg-mb-8" }, "第" + d.loopNumber + "次循环 · 第" + d.turnNumber + "回合" + (d.ts ? " · " + new Date(d.ts).toLocaleString() : "")),
              el("div", { style: "font-weight:600;" }, d.cause || "未知死因"),
              el("div", { class: "tlg-faded tlg-mt-8" }, d.details || "")
            ));
          });
        }
      } else if (type === "clue") {
        if (!state.clueTable || !state.clueTable.length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          state.clueTable.forEach(clue => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                el("span", { class: "tlg-tag tlg-tag-" + (clue.type || "event") }, clue.type === "stable" ? "稳定" : clue.type === "death" ? "死因" : clue.type === "location" ? "地点" : "事件"),
                el("span", { class: "tlg-faded" }, "第" + (clue.fromLoop || "?") + "次循环")
              ),
              el("div", { class: "tlg-mt-8" }, clue.summary || clue.text || "")
            ));
          });
        }
      } else if (type === "rewind") {
        if (!state.rewindTable || !state.rewindTable.length) {
          body.appendChild(el("div", { class: "tlg-empty" }, "暂无数据"));
        } else {
          state.rewindTable.forEach(r => {
            body.appendChild(el("div", { class: "tlg-card" },
              el("div", { class: "tlg-faded tlg-mb-8" }, "第" + r.loopNumber + "次循环结束" + (r.ts ? " · " + new Date(r.ts).toLocaleString() : "")),
              el("div", null, r.reason || "")
            ));
          });
        }
      }
      return panel;
    },

    renderSidebar() {
      const state = App.state;
      const sidebar = el("div", { class: "tlg-sidebar" });
      const header = el("div", { class: "tlg-topbar" },
        el("div", { class: "tlg-title" }, "侧边栏"),
        el("button", { class: "tlg-icon-btn", onclick: () => App.root.classList.remove("sidebar-open") }, el("span", { innerHTML: svgIcon("close", 20) }))
      );
      sidebar.appendChild(header);

      const tabBar = el("div", { class: "tlg-tab-bar" });
      const tabs = ["线索", "死亡", "回溯", "角色", "地点", "记忆"];
      const panels = [];
      let activeTab = 0;
      const panelContainer = el("div", { class: "tlg-scroll", style: "flex:1;" });

      tabs.forEach((t, i) => {
        const tab = el("div", { class: "tlg-tab" + (i === 0 ? " active" : ""), onclick: () => {
          activeTab = i;
          tabBar.querySelectorAll(".tlg-tab").forEach((node, j) => {
            node.classList.toggle("active", j === i);
          });
          renderPanel();
        } }, t);
        tabBar.appendChild(tab);
      });
      sidebar.appendChild(tabBar);
      sidebar.appendChild(panelContainer);

      const renderPanel = () => {
        panelContainer.replaceChildren();
        const inner = el("div", { class: "tlg-content" });
        if (!state) {
          inner.appendChild(el("div", { class: "tlg-empty" }, "无数据"));
          panelContainer.appendChild(inner);
          return;
        }
        if (activeTab === 0) {
          // 线索
          // 管理员模式开关
          const adminBar = el("div", { class: "tlg-row tlg-mb-8", style: "justify-content:space-between;" },
            el("span", { class: "tlg-faded" }, "管理员模式可删改线索"),
            el("button", { class: "tlg-btn-ghost", onclick: async () => {
              App._adminMode = !App._adminMode;
              renderPanel();
            } }, App._adminMode ? "管理员：开" : "管理员：关")
          );
          inner.appendChild(adminBar);
          if (!state.clueTable.length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "暂无线索"));
          } else {
            state.clueTable.forEach((clue, idx) => {
              const card = el("div", { class: "tlg-card" },
                el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                  el("span", { class: "tlg-tag tlg-tag-" + (clue.type || "event") }, clue.type === "stable" ? "稳定" : clue.type === "death" ? "死因" : clue.type === "location" ? "地点" : "事件"),
                  el("span", { class: "tlg-faded" }, "第" + (clue.fromLoop || "?") + "次循环")
                ),
                el("div", { class: "tlg-mt-8" }, clue.summary || clue.text || "")
              );
              if (App._adminMode) {
                const btnRow = el("div", { class: "tlg-row tlg-mt-8 tlg-gap-8" });
                btnRow.appendChild(el("button", { class: "tlg-btn-ghost", onclick: async () => {
                  const ok = await window.Roche.ui.confirm({ title: "删除线索", message: "确定删除此线索？" });
                  if (!ok) return;
                  state.clueTable.splice(idx, 1);
                  await Engine.saveState(state);
                  renderPanel();
                } }, "删除"));
                btnRow.appendChild(el("button", { class: "tlg-btn-ghost", onclick: () => {
                  const newText = prompt("编辑线索内容：", clue.summary || clue.text || "");
                  if (newText != null) {
                    clue.summary = newText;
                    Engine.saveState(state);
                    renderPanel();
                  }
                } }, "编辑"));
                card.appendChild(btnRow);
              }
              inner.appendChild(card);
            });
          }
        } else if (activeTab === 1) {
          // 死亡
          if (!state.deathTable.length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "暂无死亡记录"));
          } else {
            state.deathTable.forEach(d => {
              inner.appendChild(el("div", { class: "tlg-card" },
                el("div", { class: "tlg-faded tlg-mb-8" }, "第" + d.loopNumber + "次循环 · 第" + d.turnNumber + "回合"),
                el("div", { style: "font-weight:600;" }, d.cause || "未知死因"),
                el("div", { class: "tlg-faded tlg-mt-8" }, d.details || "")
              ));
            });
          }
        } else if (activeTab === 2) {
          // 回溯
          if (!state.rewindTable.length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "暂无回溯记录"));
          } else {
            state.rewindTable.forEach(r => {
              inner.appendChild(el("div", { class: "tlg-card" },
                el("div", { class: "tlg-faded tlg-mb-8" }, "第" + r.loopNumber + "次循环结束"),
                el("div", null, r.reason || "")
              ));
            });
          }
        } else if (activeTab === 3) {
          // 角色
          if (!state.characterTable || !Object.keys(state.characterTable).length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "暂无角色"));
          } else {
            for (const id in state.characterTable) {
              const c = state.characterTable[id];
              inner.appendChild(el("div", { class: "tlg-card" },
                el("div", { class: "tlg-row", style: "justify-content:space-between;" },
                  el("div", { style: "font-weight:600;" }, c.name || c.handle || "未命名"),
                  el("span", { class: "tlg-tag" + (c.present ? "" : " tlg-faded") }, c.present ? "在场" : "退场")
                ),
                c.crossLoopObservation ? el("div", { class: "tlg-faded tlg-mt-8" }, c.crossLoopObservation) : null
              ));
            }
          }
        } else if (activeTab === 4) {
          // 地点
          if (!state.locationTable.length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "暂无地点"));
          } else {
            state.locationTable.forEach(loc => {
              inner.appendChild(el("div", { class: "tlg-card" },
                el("div", { style: "font-weight:600;" }, loc.name || "未命名"),
                loc.description ? el("div", { class: "tlg-faded tlg-mt-8" }, loc.description) : null,
                loc.crossLoopMemory ? el("div", { class: "tlg-mt-8" }, loc.crossLoopMemory) : null
              ));
            });
          }
        } else if (activeTab === 5) {
          // 记忆表
          if (!state.memoryTable.length) {
            inner.appendChild(el("div", { class: "tlg-empty" }, "本次循环暂无记忆"));
          } else {
            state.memoryTable.forEach(m => {
              inner.appendChild(el("div", { class: "tlg-card" },
                el("div", { class: "tlg-faded tlg-mb-8" }, (m.time || "") + " · " + (m.location || "")),
                el("div", null, m.summary || ""),
                m.characters && m.characters.length ? el("div", { class: "tlg-faded tlg-mt-8" }, "涉及：" + m.characters.join("、")) : null
              ));
            });
          }
        }
        panelContainer.appendChild(inner);
      };
      renderPanel();
      return sidebar;
    },

    renderSettings() {
      const wrap = el("div", null);
      const s = App.settings;

      // 系统日志开关
      wrap.appendChild(el("div", { class: "tlg-card" },
        el("div", { class: "tlg-label" }, "系统日志"),
        el("div", { class: "tlg-row", style: "justify-content:space-between;" },
          el("span", { class: "tlg-faded" }, "记录每次 API 调用的提示词与回复"),
          el("button", { class: "tlg-btn-ghost", onclick: async () => {
            s.logEnabled = !s.logEnabled;
            await App.saveSettings();
            this.render();
          } }, s.logEnabled ? "已开启" : "已关闭")
        ),
        el("button", { class: "tlg-btn-ghost tlg-mt-8", onclick: () => App.navigate("logs") }, "查看日志")
      ));

      // 主题切换（日间 / 夜间）
      wrap.appendChild(el("div", { class: "tlg-card" },
        el("div", { class: "tlg-label" }, "侧边栏主题"),
        el("div", { class: "tlg-row", style: "justify-content:space-between;" },
          el("span", { class: "tlg-faded" }, "悬浮球面板与菜单的配色"),
          el("div", { class: "tlg-row tlg-gap-8" },
            el("button", { class: "tlg-btn-ghost", onclick: async () => {
              s.theme = "light";
              await App.saveSettings();
              App.applyTheme();
              this.render();
            } }, s.theme === "light" ? "[日间]" : "日间"),
            el("button", { class: "tlg-btn-ghost", onclick: async () => {
              s.theme = "dark";
              await App.saveSettings();
              App.applyTheme();
              this.render();
            } }, s.theme === "dark" ? "[夜间]" : "夜间")
          )
        )
      ));

      // 流式生成开关
      wrap.appendChild(el("div", { class: "tlg-card" },
        el("div", { class: "tlg-label" }, "主 API 流式生成"),
        el("div", { class: "tlg-row", style: "justify-content:space-between;" },
          el("span", { class: "tlg-faded" }, "实时显示生成中的文本，关闭则等完整输出。流式失败会自动降级。"),
          el("button", { class: "tlg-btn-ghost", onclick: async () => {
            s.streamEnabled = !s.streamEnabled;
            await App.saveSettings();
            this.render();
          } }, s.streamEnabled ? "已开启" : "已关闭")
        )
      ));

      // 安全区域（滑块）
      const safeCard = el("div", { class: "tlg-card" });
      safeCard.appendChild(el("div", { class: "tlg-label" }, "顶栏安全区域"));
      const topRow = el("div", { style: "display:flex;align-items:center;gap:10px;" });
      const topRange = el("input", { class: "tlg-range", type: "range", min: "0", max: "100", step: "1", value: String(s.safeTop || 0) });
      const topSpan = el("span", { style: "min-width:50px;text-align:right;" }, (s.safeTop || 0) + "px");
      topRange.addEventListener("input", async (e) => {
        s.safeTop = parseInt(e.target.value) || 0;
        topSpan.textContent = s.safeTop + "px";
        App.applySafeArea();
        await App.saveSettings();
      });
      topRow.appendChild(topRange);
      topRow.appendChild(topSpan);
      safeCard.appendChild(topRow);

      safeCard.appendChild(el("div", { class: "tlg-label tlg-mt-16" }, "底栏安全区域"));
      const botRow = el("div", { style: "display:flex;align-items:center;gap:10px;" });
      const botRange = el("input", { class: "tlg-range", type: "range", min: "0", max: "100", step: "1", value: String(s.safeBottom || 0) });
      const botSpan = el("span", { style: "min-width:50px;text-align:right;" }, (s.safeBottom || 0) + "px");
      botRange.addEventListener("input", async (e) => {
        s.safeBottom = parseInt(e.target.value) || 0;
        botSpan.textContent = s.safeBottom + "px";
        App.applySafeArea();
        await App.saveSettings();
      });
      botRow.appendChild(botRange);
      botRow.appendChild(botSpan);
      safeCard.appendChild(botRow);
      wrap.appendChild(safeCard);

      // API 配置
      wrap.appendChild(el("div", { class: "tlg-card" },
        el("div", { class: "tlg-label" }, "API 配置"),
        el("div", { class: "tlg-faded tlg-mb-8" }, "三个角色均可独立配置或继承 Roche 默认")
      ));
      ["main", "sub1", "sub2"].forEach(role => {
        const cfg = s.apiConfig[role];
        const roleLabel = role === "main" ? "主 API" : role === "sub1" ? "副 API 1" : "副 API 2";
        const card = el("div", { class: "tlg-card" },
          el("div", { style: "font-weight:600;margin-bottom:8px;" }, roleLabel),
          el("div", { class: "tlg-row", style: "justify-content:space-between;" },
            el("span", { class: "tlg-faded" }, "使用 Roche 默认"),
            el("button", { class: "tlg-btn-ghost", onclick: async () => {
              cfg.useRoche = !cfg.useRoche;
              await App.saveSettings();
              this.render();
            } }, cfg.useRoche ? "是" : "否")
          )
        );
        if (!cfg.useRoche) {
          card.appendChild(el("div", { class: "tlg-label tlg-mt-8" }, "API 链接（OpenAI 兼容）"));
          card.appendChild(el("input", { class: "tlg-input", value: cfg.endpoint || "", placeholder: "https://api.openai.com/v1", oninput: (e) => { cfg.endpoint = e.target.value; } }));
          card.appendChild(el("div", { class: "tlg-label tlg-mt-8" }, "API Key"));
          card.appendChild(el("input", { class: "tlg-input", type: "password", value: cfg.apiKey || "", placeholder: "sk-...", oninput: (e) => { cfg.apiKey = e.target.value; } }));

          // 模型选择 + 刷新按钮
          const modelCol = el("div", { style: "flex:1;" });
          modelCol.appendChild(el("div", { class: "tlg-label" }, "模型"));
          const modelSelect = el("select", { class: "tlg-input", id: "tlg-model-select-" + role });
          if (cfg.model) {
            modelSelect.appendChild(el("option", { value: cfg.model }, cfg.model));
          } else {
            modelSelect.appendChild(el("option", { value: "" }, "请选择或刷新模型列表"));
          }
          modelSelect.addEventListener("change", (e) => { cfg.model = e.target.value; });
          modelCol.appendChild(modelSelect);

          const refreshBtn = el("button", { class: "tlg-btn-ghost", style: "white-space:nowrap;align-self:flex-end;" }, "刷新模型列表");
          refreshBtn.addEventListener("click", async () => {
            const endpoint = (cfg.endpoint || "").trim().replace(/\/+$/, "");
            const apiKey = (cfg.apiKey || "").trim();
            if (!endpoint || !apiKey) {
              window.Roche.ui.toast("请先填写链接和 Key");
              return;
            }
            refreshBtn.disabled = true;
            refreshBtn.textContent = "获取中...";
            try {
              const res = await fetch(endpoint + "/models", {
                headers: { "Authorization": "Bearer " + apiKey }
              });
              if (!res.ok) {
                throw new Error("HTTP " + res.status);
              }
              const json = await res.json();
              const data = (json && json.data) || [];
              const models = data.map(m => m.id).filter(Boolean).sort();
              // 清空 select
              modelSelect.replaceChildren();
              // 如果当前 cfg.model 不在列表里，把它作为第一个 option 加进去
              if (cfg.model && !models.includes(cfg.model)) {
                modelSelect.appendChild(el("option", { value: cfg.model }, cfg.model));
              }
              models.forEach(m => {
                modelSelect.appendChild(el("option", { value: m }, m));
              });
              // 选中当前 cfg.model
              if (cfg.model) {
                modelSelect.value = cfg.model;
              }
              window.Roche.ui.toast("已获取 " + models.length + " 个模型");
            } catch (e) {
              window.Roche.ui.toast("获取失败：" + (e.message || "未知错误"));
            } finally {
              refreshBtn.disabled = false;
              refreshBtn.textContent = "刷新模型列表";
            }
          });

          const modelRow = el("div", { class: "tlg-row tlg-mt-8", style: "align-items:flex-end;gap:8px;" }, modelCol);
          modelRow.appendChild(refreshBtn);
          card.appendChild(modelRow);

          card.appendChild(el("div", { class: "tlg-label tlg-mt-8" }, "Temperature"));
          card.appendChild(el("input", { class: "tlg-input", type: "number", step: "0.1", value: cfg.temperature, oninput: (e) => { cfg.temperature = parseFloat(e.target.value) || 0; } }));
          card.appendChild(el("button", { class: "tlg-btn-ghost tlg-mt-8", onclick: async () => { await App.saveSettings(); window.Roche.ui.toast("已保存"); } }, "保存"));
        }
        wrap.appendChild(card);
      });

      // 文风与常驻指令（仅当 App.state 存在时显示）
      if (App.state) {
        const styleCard = el("div", { class: "tlg-card" },
          el("div", { class: "tlg-label" }, "文风与常驻指令"),
          el("div", { class: "tlg-faded tlg-mb-8" }, "游戏中可随时编辑，保存后下一回合生效")
        );
        styleCard.appendChild(el("div", { class: "tlg-label" }, "文风"));
        const styleInput = el("textarea", { class: "tlg-textarea", value: App.state.style || "", placeholder: "第三人称，细腻心理描写，悬疑氛围" });
        styleCard.appendChild(styleInput);
        styleCard.appendChild(el("div", { class: "tlg-label tlg-mt-8" }, "常驻指令（每行一条）"));
        const standingInput = el("textarea", { class: "tlg-textarea", value: (App.state.standingOrders || []).join("\n"), placeholder: "每行一条，如：保持角色神秘感 / 每回合提供2-4个选项" });
        styleCard.appendChild(standingInput);
        styleCard.appendChild(el("button", { class: "tlg-btn-ghost tlg-mt-8", onclick: async () => {
          App.state.style = styleInput.value || "";
          App.state.standingOrders = standingInput.value.split("\n").map(s => s.trim()).filter(Boolean);
          await Engine.saveCurrent(App.state);
          window.Roche.ui.toast("已保存");
        } }, "保存"));
        wrap.appendChild(styleCard);
      }

      // 清空数据
      wrap.appendChild(el("div", { class: "tlg-card" },
        el("button", { class: "tlg-btn", style: "width:100%;background:#8b0000;", onclick: async () => {
          const ok = await window.Roche.ui.confirm({ title: "清空插件数据", message: "将清空所有存档、日志、独立数据库。确定？" });
          if (!ok) return;
          await Store.del(STORAGE_KEYS.state);
          await Store.del(STORAGE_KEYS.settings);
          await Store.del(STORAGE_KEYS.logs);
          await Store.del(STORAGE_KEYS.saves);
          try { await IDB.clear("loopHistory"); } catch(e){}
          try { await IDB.clear("rawLogs"); } catch(e){}
          window.Roche.ui.toast("已清空");
          App.state = null;
          App.navigate("home");
        } }, "清空所有插件数据")
      ));

      return wrap;
    },

    renderLogs() {
      const wrap = el("div", null);
      wrap.appendChild(el("div", { class: "tlg-empty" }, "加载中..."));
      // 异步加载日志后填充
      Logger.getAll().then(logs => {
        wrap.replaceChildren();
        if (!logs.length) {
          wrap.appendChild(el("div", { class: "tlg-empty" }, "暂无日志（请在设置中开启）"));
          return;
        }
        logs.forEach(log => {
        const card = el("div", { class: "tlg-card" },
          el("div", { class: "tlg-row", style: "justify-content:space-between;" },
            el("span", { class: "tlg-tag" }, log.role === "main" ? "主" : log.role === "sub1" ? "副1" : "副2"),
            el("span", { class: "tlg-faded" }, new Date(log.ts).toLocaleString() + (log.loopNumber ? " L" + log.loopNumber : "") + (log.turnNumber ? " T" + log.turnNumber : ""))
          ),
          el("div", { class: "tlg-label tlg-mt-8" }, "提示词"),
          el("div", { class: "tlg-card", style: "font-size:12px;white-space:pre-wrap;max-height:200px;overflow-y:auto;" }, (log.messages || []).map(m => "### " + m.role + "\n" + m.content).join("\n\n")),
          el("div", { class: "tlg-label tlg-mt-8" }, "回复"),
          el("div", { class: "tlg-card", style: "font-size:12px;white-space:pre-wrap;max-height:300px;overflow-y:auto;" }, log.reply || "")
        );
          wrap.appendChild(card);
        });
      });
      return wrap;
    },
  };

  // ============================================================
  // 插件注册
  // ============================================================
  window.RochePlugin.register({
    id: "time-loop-game",
    name: "时间循环文游",
    version: "1.0.0",
    apps: [
      {
        id: "time-loop-game-home",
        name: "时间循环文游",
        icon: "extension",
        iconImage: "",
        async mount(container, roche) {
          App.container = container;
          App.roche = roche;

          // 创建根元素
          const root = el("div", { class: ROOT_CLASS });
          App.root = root;

          // 注入样式
          const style = document.createElement("style");
          style.setAttribute("data-tlg", "true");
          style.textContent = CSS;
          document.head.appendChild(style);
          App._style = style;

          // 加载设置
          await App.loadSettings();
          App.applySafeArea();
          App.applyTheme();

          // 渲染
          container.appendChild(root);
          UI.render();
        },
        async unmount(container, roche) {
          if (App._style && App._style.parentNode) {
            App._style.parentNode.removeChild(App._style);
          }
          App.listeners = [];
          App.root = null;
          App.container = null;
          App.state = null;
          container.replaceChildren();
        },
      },
    ],
  });
})();

/* SVG Hopper 0.1 — deterministic, local-only SVG composition.
   Copy stays live <text>/<tspan>, not glyph outlines or pixels. */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const byId = id => document.getElementById(id);
  const form = byId("controls");
  const preview = byId("previewCanvas");
  const status = byId("status");
  const downloadButton = byId("download");
  const languageButtons = [...document.querySelectorAll("[data-lang]")];
  const photoFields = byId("photoFields");
  const font = 'Arial, Helvetica, sans-serif';
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");

  const styles = {
    ink: { background:"#1b2027", panel:"#111418", accent:"#d3dce6", lines:"#718091" },
    blue:{ background:"#d8ebf1", panel:"#113954", accent:"#77d6e5", lines:"#416f91" },
    green:{ background:"#e6eed6", panel:"#19392f", accent:"#aad39e", lines:"#6e9679" }
  };
  const sizes = { "16:9":675, "4:3":900, "1:1":1200, "9:16":2133 };
  const state = { language:"en", imageData:null, svg:null, photoRead:0 };

  function element(tag, attrs = {}, content) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function error(message) {
    state.svg = null;
    downloadButton.disabled = true;
    status.dataset.error = "true";
    status.textContent = message;
    const prompt = document.createElement("p");
    prompt.className = "hint";
    prompt.style.padding = "40px 24px";
    prompt.textContent = message;
    preview.replaceChildren(prompt);
  }

  function measureWidth(text, size) {
    measure.font = "700 " + size + "px " + font;
    return measure.measureText(text).width;
  }

  // Always split words that exceed the line width. No hidden clipping.
  function wrap(value, maxWidth, fontSize) {
    const rows = [];
    for (const paragraph of value.split(/\n/)) {
      if (!paragraph.trim()) continue;
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (!word) continue;
        const next = line ? line + " " + word : word;
        if (measureWidth(next, fontSize) <= maxWidth) { line = next; continue; }
        if (line) { rows.push(line); line = ""; }
        if (measureWidth(word, fontSize) <= maxWidth) { line = word; continue; }
        for (const letter of Array.from(word)) {
          if (line && measureWidth(line + letter, fontSize) > maxWidth) { rows.push(line); line = ""; }
          line += letter;
        }
      }
      if (line) rows.push(line);
    }
    return rows;
  }

  function layout(headline, height) {
    const maxWidth = 1040;
    for (let size = 88; size >= 36; size -= 4) {
      const rows = wrap(headline, maxWidth, size);
      const lineHeight = Math.round(size * 1.16);
      const panelHeight = 74 + rows.length * lineHeight + 66;
      if (rows.length && rows.length <= 6 && panelHeight <= height * 0.72) {
        return { rows, size, lineHeight, panelHeight };
      }
    }
    return null;
  }

  function buildSvg() {
    const locale = state.language;
    const headline = byId(locale + "Title").value.trim();
    const description = byId(locale + "Desc").value.trim();
    const mode = byId("mode").value;
    const height = sizes[byId("ratio").value] || 675;
    const colors = styles[byId("preset").value] || styles.ink;
    if (!headline) return { message: "Add a " + (locale === "es" ? "Spanish" : "English") + " headline before generating." };
    if (mode === "photo" && !state.imageData) return { message: "Choose a PNG, JPEG, or WebP photo to use the photo composition." };
    const textLayout = layout(headline, height);
    if (!textLayout) return { message: "That headline does not fit this format. Try shorter text or a taller aspect ratio." };

    const svg = element("svg", {
      xmlns:NS, width:1200, height, viewBox:"0 0 1200 " + height,
      role:"img", "aria-labelledby":description ? "hopper-title hopper-description" : "hopper-title",
      "xml:lang":locale
    });
    svg.append(element("title", {id:"hopper-title"}, headline));
    if (description) svg.append(element("desc", {id:"hopper-description"}, description));
    svg.append(element("rect", {width:1200,height,fill:colors.background}));

    if (mode === "photo") {
      svg.append(element("image", {
        x:0,y:0,width:1200,height,
        href:state.imageData,
        preserveAspectRatio:byId("photoFit").value === "contain" ? "xMidYMid meet" : "xMidYMid slice"
      }));
    } else {
      // Purposefully simple vector decoration; no raster layers or external assets.
      svg.append(element("circle", {cx:1020,cy:Math.round(height*.20),r:320,fill:colors.accent,opacity:".65"}));
      svg.append(element("circle", {cx:840,cy:Math.round(height*.29),r:190,fill:"none",stroke:colors.lines,"stroke-width":18,opacity:".75"}));
      svg.append(element("path", {d:"M -60 " + Math.round(height*.32) + " Q 390 " + Math.round(height*.05) + " 840 " + Math.round(height*.33),
        fill:"none",stroke:colors.lines,"stroke-width":8,opacity:".68"}));
      svg.append(element("rect", {x:76,y:74,width:105,height:12,fill:colors.panel}));
    }
    const y = height - textLayout.panelHeight;
    svg.append(element("rect", {x:0,y,width:1200,height:textLayout.panelHeight,fill:colors.panel}));
    svg.append(element("rect", {x:78,y:y+32,width:84,height:8,fill:colors.accent}));
    const text = element("text", {
      x:78,y:y+80+textLayout.size,fill:"#ffffff",
      "font-family":font,"font-size":textLayout.size,"font-weight":700,
      "letter-spacing":"-0.02em"
    });
    textLayout.rows.forEach((row, i) => {
      const tspan = element("tspan",{x:78,dy:i===0?0:textLayout.lineHeight},row);
      text.append(tspan);
    });
    svg.append(text);
    return { svg, height, mode };
  }

  function render() {
    const mode = byId("mode").value;
    photoFields.hidden = mode !== "photo";
    const result = buildSvg();
    if (result.message) { error(result.message); return; }
    state.svg = result.svg;
    preview.replaceChildren(result.svg);
    byId("sizeLabel").textContent = "1200 × " + result.height + " · SVG";
    byId("fileType").textContent = result.mode === "photo" ? "Raster photo + vector text" : "100% vector illustration";
    byId("languageLabel").textContent = state.language === "es" ? "Vista previa en español" : "English preview";
    languageButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.lang === state.language));
    downloadButton.disabled = false;
    status.dataset.error = "false";
    status.textContent = "SVG ready. " + (state.language === "es" ? "Spanish" : "English") + " text is editable and exportable.";
  }

  function download() {
    if (!state.svg) return;
    const markup = new XMLSerializer().serializeToString(state.svg);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', markup],{type:"image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "svg-hopper-" + state.language + "-" + byId("ratio").value.replace(":","x") + ".svg";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url),1000);
    status.dataset.error = "false";
    status.textContent = "SVG downloaded. Supply appropriate alt text and review in its publishing context.";
  }

  function readPhoto(file) {
    const readId = ++state.photoRead;
    if (!file) { state.imageData = null; render(); return; }
    const validTypes = new Set(["image/png","image/jpeg","image/webp"]);
    if (!validTypes.has(file.type) || file.size > 8 * 1024 * 1024) {
      state.imageData = null;
      error("Use a PNG, JPEG, or WebP image smaller than 8 MB.");
      return;
    }
    status.textContent = "Reading the photo locally…";
    const reader = new FileReader();
    reader.onerror = () => { if (readId === state.photoRead) error("The image could not be read."); };
    reader.onload = () => {
      if (readId !== state.photoRead) return;
      const data = String(reader.result || "");
      const image = new Image();
      image.onerror = () => { if (readId === state.photoRead) error("The selected file is not a readable image."); };
      image.onload = () => {
        if (readId !== state.photoRead) return;
        if (image.naturalWidth > 12000 || image.naturalHeight > 12000) { error("Choose a photo with dimensions no larger than 12,000 pixels per side."); return; }
        state.imageData = data;
        byId("mode").value = "photo";
        render();
      };
      image.src = data;
    };
    reader.readAsDataURL(file);
  }

  form.addEventListener("submit", event => { event.preventDefault(); render(); });
  form.addEventListener("input", event => {
    if (event.target.id !== "photo") render();
  });
  form.addEventListener("change", event => {
    if (event.target.id === "photo") readPhoto(event.target.files[0]);
    else render();
  });
  languageButtons.forEach(button => button.addEventListener("click", () => {
    state.language = button.dataset.lang;
    languageButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    render();
  }));
  downloadButton.addEventListener("click", download);
  render();
})();

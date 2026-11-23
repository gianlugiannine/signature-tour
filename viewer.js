"use strict";

const $ = id => document.getElementById(id);
const phone = matchMedia("(max-width: 820px) and (orientation: portrait)");
const menu = $("chapter-menu");
const statusLine = $("load-status");
let chapters, scenes, active, requestNumber = 0;

function button(label, action) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.addEventListener("click", action);
  return control;
}

function go(id, keyboard = false) {
  if (!scenes.has(id) || active?.id === id) return;
  const depth = history.state?.tourDepth || 0;
  history.pushState({ tourDepth: depth + 1 }, "", "#" + id);
  render(id, keyboard);
}

function currentId() {
  const id = location.hash.slice(1);
  return scenes.has(id) ? id : chapters[0].start;
}

function paintControls(scene, device) {
  const hotspots = [], choices = [];
  for (const link of scene.links) {
    const follow = event => go(link.to, event.detail === 0);
    const spot = button("", follow);
    const [x, y, width, height] = link[device];
    spot.className = "target";
    spot.dataset.to = link.to;
    spot.setAttribute("aria-label", link.label);
    spot.title = link.label;
    spot.style.left = x * 100 + "%";
    spot.style.top = y * 100 + "%";
    spot.style.width = width * 100 + "%";
    spot.style.height = height * 100 + "%";
    hotspots.push(spot);
    const choice = button(link.label, follow);
    choice.dataset.choice = link.to;
    choices.push(choice);
  }
  if (scene.finish) {
    const next = chapters[chapters.findIndex(item => item.id === scene.chapter) + 1];
    choices.push(next
      ? button("Continue to " + next.title, event => go(next.start, event.detail === 0))
      : button("Choose another chapter", openMenu));
  }
  $("hotspots").replaceChildren(...hotspots);
  $("choices").replaceChildren(...choices);
}

async function render(id, keyboard = false) {
  const ticket = ++requestNumber;
  const scene = scenes.get(id);
  const chapter = chapters.find(item => item.id === scene.chapter);
  const device = phone.matches ? "phone" : "wide";
  if (active && active.id !== id && matchMedia("(max-width: 820px) and (orientation: portrait) and (max-height: 760px)").matches) window.scrollTo(0, 0);
  active = scene;
  $("back").disabled = !history.state?.tourDepth && id === chapter.start;
  $("chapter-name").textContent = chapter.title + " · Interactive tour";
  $("scene-title").textContent = scene.title;
  $("hint").textContent = scene.hint;
  document.title = scene.title + " · Central Command tour";
  $("screen").hidden = true;
  $("choices").replaceChildren();
  statusLine.hidden = false;
  statusLine.textContent = "Loading screen…";
  const frame = new Image();
  frame.id = "capture";
  frame.alt = scene.alt;
  frame.src = "./screens/" + id + "-" + device + ".webp";
  try {
    await frame.decode();
    if (ticket !== requestNumber) return;
    $("capture").replaceWith(frame);
    paintControls(scene, device);
    statusLine.hidden = true;
    $("screen").hidden = false;
    if (keyboard) $("scene-title").focus({ preventScroll: true });
  } catch {
    if (ticket !== requestNumber) return;
    statusLine.replaceChildren(button("Reload this screen", () => render(id)));
  }
}

function openMenu() {
  for (const item of $("menu-items").children) {
    if (item.dataset.start === chapters.find(chapter => chapter.id === active.chapter).start) {
      item.setAttribute("aria-current", "true");
    } else item.removeAttribute("aria-current");
  }
  menu.showModal();
}

async function start() {
  const response = await fetch("./tour.json?v=signature-1");
  if (!response.ok) throw Error("Chapters unavailable");
  const catalog = await response.json();
  chapters = catalog.chapters;
  scenes = new Map(catalog.scenes.map(scene => [scene.id, scene]));
  for (const chapter of chapters) {
    const entry = button("", event => { menu.close(); go(chapter.start, event.detail === 0); });
    entry.className = "chapter";
    entry.dataset.start = chapter.start;
    const text = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent = chapter.title;
    detail.textContent = chapter.description;
    text.append(title, detail);
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    entry.append(text, arrow);
    $("menu-items").append(entry);
  }
  $("chapters-toggle").disabled = false;
  $("chapters-toggle").addEventListener("click", openMenu);
  $("close-menu").addEventListener("click", () => menu.close());
  menu.addEventListener("click", event => {
    if (event.target !== menu) return;
    const bounds = menu.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) menu.close();
  });
  $("back").addEventListener("click", () => {
    if (history.state?.tourDepth) history.back();
    else {
      const start = chapters.find(item => item.id === active.chapter).start;
      history.replaceState({ tourDepth: 0 }, "", "#" + start);
      render(start, true);
    }
  });
  window.addEventListener("hashchange", () => {
    const id = currentId();
    if (active?.id !== id) render(id);
  });
  phone.addEventListener("change", () => render(currentId()));
  const id = currentId();
  history.replaceState({ tourDepth: history.state?.tourDepth || 0 }, "", "#" + id);
  await render(id);
}

start().catch(() => {
  statusLine.replaceChildren(button("Reload the tour", () => location.reload()));
});

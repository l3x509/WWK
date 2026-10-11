/* Title autocomplete (combobox). Depends on wwk-core.js.
   WWKSearch.attach(input, { onSelect(result), onSubmit(query) }) */
(function (root) {
  "use strict";
  var W = root.WWK;
  function attach(input, opts) {
    opts = opts || {};
    var box = document.createElement("ul");
    box.className = "wwk-sugg"; box.setAttribute("role", "listbox"); box.id = "sugg-" + Math.random().toString(36).slice(2, 7);
    box.hidden = true;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", box.id);
    input.setAttribute("autocomplete", "off");
    input.parentNode.appendChild(box);
    var items = [], active = -1, timer = null, seq = 0;

    function close() { box.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); }
    function setActive(i) {
      var lis = box.children;
      if (active >= 0 && lis[active]) lis[active].setAttribute("aria-selected", "false");
      active = i;
      if (i >= 0 && lis[i]) { lis[i].setAttribute("aria-selected", "true"); input.setAttribute("aria-activedescendant", lis[i].id); }
      else input.removeAttribute("aria-activedescendant");
    }
    function render(list, q) {
      items = list; box.innerHTML = "";
      if (!list.length) {
        box.innerHTML = '<li class="sugg-empty" role="option" aria-disabled="true">No matches for “' + W.esc(q) + '”. Check the spelling?</li>';
      } else {
        list.forEach(function (r, i) {
          var li = document.createElement("li");
          li.setAttribute("role", "option"); li.id = box.id + "-" + i; li.setAttribute("aria-selected", "false");
          li.innerHTML = (r.poster ? '<img src="https://image.tmdb.org/t/p/w92' + W.esc(r.poster) + '" alt="" loading="lazy" width="32" height="48">' : '<span class="sugg-ph">🎬</span>') +
            '<span class="sugg-t">' + W.esc(r.title) + '</span><span class="sugg-m">' + (r.year || "") + (r.year ? " · " : "") + (r.type === "movie" ? "Movie" : "TV show") + "</span>";
          li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(i); });
          box.appendChild(li);
        });
      }
      box.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1;
    }
    function choose(i) { var r = items[i]; if (r) { close(); opts.onSelect && opts.onSelect(r); } }

    input.addEventListener("input", function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () {
        var my = ++seq;
        W.searchTitles(q).then(function (list) { if (my === seq && document.activeElement === input) render(list, q); });
      }, 250);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && !box.hidden && items.length) { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === "ArrowUp" && !box.hidden && items.length) { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
      else if (e.key === "Escape") close();
      else if (e.key === "Enter") {
        e.preventDefault();
        if (active >= 0) choose(active);
        else { var q = input.value.trim(); if (q.length >= 2) { close(); clearTimeout(timer); opts.onSubmit && opts.onSubmit(q); } }
      }
    });
    input.addEventListener("blur", function () { setTimeout(close, 120); });
    return { close: close };
  }
  root.WWKSearch = { attach: attach };
})(window);

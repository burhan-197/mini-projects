// Showcase filtering: category buttons + name search, combined. Vanilla JS.
(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".filter-btn"));
  var cards = Array.prototype.slice.call(document.querySelectorAll(".project-card"));
  var searchInput = document.getElementById("search");
  var resultCount = document.getElementById("resultCount");
  var emptyState = document.getElementById("emptyState");
  var activeFilter = "all";

  function apply() {
    var term = searchInput.value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var inCategory = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
      var inSearch = !term || card.getAttribute("data-search").indexOf(term) !== -1;
      var show = inCategory && inSearch;
      card.hidden = !show;
      if (show) visible++;
    });
    resultCount.textContent = "Showing " + visible + " of " + cards.length + " projects";
    emptyState.hidden = visible !== 0;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      activeFilter = btn.getAttribute("data-filter");
      apply();
    });
  });

  searchInput.addEventListener("input", apply);
  apply();
})();

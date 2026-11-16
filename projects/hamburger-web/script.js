const hamburger_icon = document.querySelector(".hamburger-menu");
const cross_icon = document.querySelector(".cross");
const nav_bar = document.querySelector(".nav-bar");

hamburger_icon.addEventListener("click", () => {
    nav_bar.classList.toggle("menu-open");
});

cross_icon.addEventListener("click", () => {
    nav_bar.classList.remove("menu-open");
});

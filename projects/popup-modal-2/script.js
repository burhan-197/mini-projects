const button = document.querySelector("button");
const popUp = document.querySelector(".pop-up");
const cross = document.querySelector(".cross");
const popUp_container = document.querySelector(".popup-container");
const overlay = document.querySelector(".overlay");

button.addEventListener("click", () => {
    popUp.classList.add("popup-open");
    popUp_container.classList.add("popup-open");
});

cross.addEventListener("click", () => {
    popUp.classList.remove("popup-open");
    popUp_container.classList.remove("popup-open");
});

overlay.addEventListener("click", () => {
    popUp.classList.remove("popup-open");
    popUp_container.classList.remove("popup-open");
});
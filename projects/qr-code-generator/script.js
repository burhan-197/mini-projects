const URL = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data="

const input = document.querySelector("input");
const button = document.querySelector("button");
const img = document.querySelector(".qr-code");
const error = document.querySelector(".error");

button.addEventListener("click", () => {
    if (input.value === "") {
        error.classList.add("show");
        error.style.animation = "none";
        setTimeout(() => {
            error.style.animation = "vibrate 0.5s";
        }, 10);
    } else {
        error.classList.remove("show");
        img.src = URL + input.value;
        img.style.display = "block";
    }
});

input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") button.click();
});
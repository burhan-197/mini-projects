const password = document.getElementById("password");

const icon = document.getElementById("icon");

icon.addEventListener("click", function () {
    if (password.type === "password") {
        password.type = "text"
        icon.src = "./eye-icons/eye-open.png"
    } else {
        password.type = "password"
        icon.src = "./eye-icons/eye-close.png"
    }

})

const passwordBox = document.getElementById("Password")
const button = document.querySelector(".Generate")
const CopyBtn = document.querySelector(".copy-btn img")
const length = 12;
const UpperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const LowerCase = "abcdefghijklmnopqrstuvwxyz"
const numbers = "1234567890"
const symbols = "!@#$%^&*()_-+=/*{}[]"
const allChars = UpperCase + LowerCase + symbols + numbers
function createPassword() {
    let password = ""
    password += UpperCase[Math.floor(Math.random() * UpperCase.length)]
    password += LowerCase[Math.floor(Math.random() * LowerCase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    while (length > password.length) {
        password += allChars[Math.floor(Math.random() * allChars.length)]

    }
    passwordBox.value = password
}
async function copyPassword() {
    try {
        await navigator.clipboard.writeText(passwordBox.value)
        console.log("Password copied!")
    } catch (err) {
        console.error("Failed to copy:", err)
    }
}
CopyBtn.addEventListener("click", copyPassword)
button.addEventListener("click", createPassword)
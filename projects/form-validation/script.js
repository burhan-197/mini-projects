const nameError = document.getElementById("name-error");
const phoneError = document.getElementById("phone-error");
const emailError = document.getElementById("email-error");
const messageError = document.getElementById("message-error");
const submitError = document.getElementById("submit-error");

function validateName() {
    let name = document.getElementById("contact-name").value
    if (name.lenght === 0) {
        nameError.innerHTML = "Name is required"
        return false
    }
    if (!name.match(/^[A-Za-z]*\s{1}[A-Za-z]*$/)) {
        nameError.innerHTML = "write Full name"
        return false
    }
    nameError.innerHTML = '<i class ="fas fa-check-circle"></i>';
    return true
}
function validatePhone() {
    let phone = document.getElementById("phone-name").value
    if (phone.length == 0) {
        phoneError.innerHTML = "Number is required"
        return false
    }
    if (!phone.match(/^[0-9]{11}$/)) {
        phoneError.innerHTML = "Only digits are allowed"
        return false
    }
    if (phone.length !== 11) {
        phoneError.innerHTML = "Phone no should be 11 digits"
        return false
    }

    phoneError.innerHTML = '<i class ="fas fa-check-circle"></i>';
    return true
}
function validateEmail() {
    let email = document.getElementById("email-name").value
    if (email.length == 0) {
        emailError.innerHTML = "Email is required"
        return false
    }
    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        emailError.innerHTML = "write valid email   "
        return false
    }

    emailError.innerHTML = '<i class ="fas fa-check-circle"></i>';
    return true
}
function validateMessage() {
    let message = document.getElementById("message-name").value
    if (message.length == 0) {
        messageError.innerHTML = "Message is required"
        return false
    }
    if (message.length < 10) {
        messageError.innerHTML = "Message should be at least 10 characters"
        return false
    }
    messageError.innerHTML = '<i class ="fas fa-check-circle"></i>';
    return true
}
function validateForm() {
    if (!validateName() || !validatePhone() || !validateEmail() || !validateMessage()) {
        submitError.style.display = "block"
        submitError.innerHTML = "Please fix errors before submitting"
        setTimeout(function () {
            submitError.style.display = "none"
        }, 3000)
        return false
    }
}
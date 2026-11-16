const selectField = document.getElementById("selectField");
const list = document.getElementById("list");
const options = document.querySelectorAll(".options");
const selectText = selectField.querySelector("p");

// toggle dropdown
selectField.addEventListener("click", function () {
    list.classList.toggle("open");
});

// select an option
options.forEach(function (option) {
    option.addEventListener("click", function () {
        const imgSrc = option.querySelector("img").src;
        const text = option.querySelector("p").innerHTML;
        selectText.innerHTML = '<img src="' + imgSrc + '"> ' + text;
        list.classList.remove("open");
    });
});

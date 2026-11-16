const notesContainer = document.querySelector(".notes-container");
const createBtn = document.querySelector(".btn");
let notes = document.querySelectorAll(".input-box");

function showNotes() {
    notesContainer.innerHTML = localStorage.getItem("notes");
}
showNotes()
function storageUpdate() {
    localStorage.setItem("notes", notesContainer.innerHTML);
}
createBtn.addEventListener("click", () => {
    let para = document.createElement("p");
    let img = document.createElement("img");
    img.src = "./images/delete.png";
    img.classList.add("delete-icon");
    para.setAttribute("contenteditable", "true");
    para.classList.add("input-box");
    para.appendChild(img);
    notesContainer.appendChild(para);
})
notesContainer.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG") {
        e.target.parentElement.remove();
        storageUpdate();
    } else if (e.target.tagName === "P") {
        notes = document.querySelectorAll(".input-box")
        notes.forEach(nt => {
            nt.onkeyup = function () {
                storageUpdate();
            }
        })

    }
})

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        document.execCommand("insertLinkBreak")
        event.preventDefault();
    }
})
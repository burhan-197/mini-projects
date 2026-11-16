let toastbox = document.getElementById("toastbox");

function showToast(msg, type = "success") {
    let toast = document.createElement("div");
    toast.classList.add("toast", type);
    toast.innerText = msg;
    toastbox.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("exit");
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 5000);
}

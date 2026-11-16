const imgBox = document.querySelector(".img-box");
const imgWrap = document.querySelector(".img-wrap");
const leftSpace = imgBox.offsetLeft;
const originalImg = document.getElementById("original-img");
imgBox.onmousemove = function (e) {
    let leftSide = (e.pageX - leftSpace) + "px";
    imgWrap.style.width = leftSide;
}
originalImg.style.width = imgBox.offsetWidth + "px";

let progress = document.getElementById("progress")
let song = document.getElementById("song")
let CtrlIcon = document.getElementById("ctrlIcon")
song.onloadedmetadata = function () {
    progress.max = song.duration

}
function playpause() {
    if (song.paused || song.ended) {
        song.play()
        CtrlIcon.classList.remove("fa-play")
        CtrlIcon.classList.add("fa-pause")
    } else {
        song.pause()
        CtrlIcon.classList.remove("fa-pause")
        CtrlIcon.classList.add("fa-play")
    }
}
setInterval(() => {
    progress.value = song.currentTime
}, 500)
song.ontimeupdate = function () {
    progress.value = song.currentTime
}

progress.onchange = function () {
    song.play()
    song.currentTime = progress.value
    CtrlIcon.classList.remove("fa-play")
    CtrlIcon.classList.add("fa-pause")

}
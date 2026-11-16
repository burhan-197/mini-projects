const api_url = "https://dummyjson.com/quotes/random";
const quote = document.querySelector("blockquote");
const author = document.querySelector("span");
const newQuoteBtn = document.querySelector(".new-quote");
const tweetBtn = document.querySelector(".tweet");
async function getQuote() {
    const response = await fetch(api_url);
    const data = await response.json();
    quote.innerHTML = data.quote;
    author.innerHTML = data.author;
}

newQuoteBtn.addEventListener("click", getQuote);
function tweet() {
    window.open("https://twitter.com/intent/tweet?text=" + quote.innerHTML + " - " + author.innerHTML);
}

tweetBtn.addEventListener("click", tweet);

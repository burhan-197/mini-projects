const apikey = '80207a93592483904d5b8ce6e5ad3fee'
const apiURL = "https://api.openweathermap.org/data/2.5/weather?units=metric&q="
const cityName = document.querySelector(".city-name")
const temp = document.querySelector(".temp")
const humidity = document.querySelector(".humidity")
const wind = document.querySelector(".wind")
const searchBox = document.querySelector(".search input")
const searchBtn = document.querySelector(".search button")
const weatherIcon = document.querySelector(".weather-icon")
async function checkweather(city) {
    const response = await fetch(apiURL + `${city}&appid=${apikey}`)
    let data = await response.json()
    if (data.cod == "404") {
        document.querySelector(".error").style.display = "block";
    }
    cityName.innerHTML = data.name
    temp.innerHTML = Math.round(data.main.temp) + "°C";
    humidity.innerHTML = data.main.humidity + "%";
    wind.innerHTML = Math.round(data.wind.speed) + " km/h";
    if (data.weather[0].main == "Clouds") {
        weatherIcon.src = "./images/clouds.png";
    }
    else if (data.weather[0].main == "Rain") {
        weatherIcon.src = "./images/rain.png";
    }
    else if (data.weather[0].main == "Snow") {
        weatherIcon.src = "./images/snow.png";
    }
    else if (data.weather[0].main == "Clear") {
        weatherIcon.src = "./images/clear.png";
    } else if (data.weather[0].main == "Mist") {
        weatherIcon.src = "./images/mist.png";
    } else if (data.weather[0].main == "Drizzle") {
        weatherIcon.src = "./images/drizzle.png";
    }
    document.querySelector(".weather").style.display = "block";
}

searchBtn.addEventListener("click", () => {
    checkweather(searchBox.value);
});
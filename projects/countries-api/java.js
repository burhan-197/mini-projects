
const countriesContainer = document.querySelector(".countries-container");
const filter = document.querySelector(".filter");
const searchInput = document.querySelector(".search-container input")
let allcountries
const DarkMode = document.querySelector(".dark-mode");
DarkMode.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");

    DarkMode.innerHTML = isDark
        ? `<i class="fa-regular fa-sun"></i> Light Mode`
        : `<i class="fa-regular fa-moon"></i> Dark Mode`;
})

fetch("https://restcountries.com/v3.1/all?fields=name,capital,region,flags,population")
    .then((response) => response.json())
    .then((data) => {
        allcountries = data
        data.forEach(country => {
            const countryCard = document.createElement("a");
            countryCard.classList.add("country");
            countryCard.href = `Country.html?name=${country.name.common}`;
            countryCard.innerHTML = `
<img src="${country.flags.svg}" alt="flag">
<div class="card-text">
    <h3 class="country-name">${country.name.common}</h3>
    <p><b>Population:</b> ${country.population.toLocaleString()}</p>
    <p><b>Region:</b> ${country.region}</p>
    <p><b>Capital:</b> ${country.capital}</p>
</div>`

            countriesContainer.append(countryCard)

        });

    });

filter.addEventListener("change", () => {
    fetch(`https://restcountries.com/v3.1/region/${filter.value}`)
        .then((response) => response.json())
        .then((data) => {
            countriesContainer.innerHTML = "";
            data.forEach(country => {
                const countryCard = document.createElement("a");
                countryCard.classList.add("country");
                countryCard.href = `Country.html?name=${country.name.common}`;
                countryCard.innerHTML = `
<img src="${country.flags.svg}" alt="flag">
<div class="card-text">
    <h3 class="country-name">${country.name.common}</h3>
    <p><b>Population:</b> ${country.population.toLocaleString()}</p>
    <p><b>Region:</b> ${country.region}</p>
    <p><b>Capital:</b> ${country.capital}</p>
</div>`

                countriesContainer.append(countryCard)

            });

        });
});
searchInput.addEventListener("input", (e) => {
    let filteredCountries = allcountries.filter((country) => country.name.common.toLowerCase().includes(e.target.value.toLowerCase()))
    countriesContainer.innerHTML = "";
    filteredCountries.forEach(country => {
        const countryCard = document.createElement("a");
        countryCard.classList.add("country");
        countryCard.href = `Country.html?name=${country.name.common}`;
        countryCard.innerHTML = `
<img src="${country.flags.svg}" alt="flag">
<div class="card-text">
    <h3 class="country-name">${country.name.common}</h3>
    <p><b>Population:</b> ${country.population.toLocaleString()}</p>
    <p><b>Region:</b> ${country.region}</p>
    <p><b>Capital:</b> ${country.capital}</p>
</div>`

        countriesContainer.append(countryCard)

    })


})
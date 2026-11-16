const countryName = new URLSearchParams(window.location.search).get('name');
const CountryFlag = document.querySelector(".flag img");
const COuntryName = document.querySelector("h1");
const nativeName = document.querySelector(".nativeName");
const countryPopulation = document.querySelector(".population");
const currency = document.querySelector(".currency");
const region = document.querySelector(".region");
const capital = document.querySelector(".capital");
const languages = document.querySelector(".languages");
const subRegion = document.querySelector(".subRegion");
const countryTopLevel = document.querySelector(".topLevelDomain");
const borderCountryContainer = document.querySelector(".bordered-country")
fetch(`https://restcountries.com/v3.1/name/${countryName}?fullText=true`)
    .then((response) => response.json())
    .then(([country]) => {
        CountryFlag.src = country.flags.svg;
        COuntryName.innerText = country.name.common;

        if (country.name.nativeName) {
            nativeName.innerText = Object.values(country.name.nativeName)[0].common;
        } else {
            nativeName.innerText = country.name.common;
        }
        countryPopulation.innerText = country.population.toLocaleString();
        region.innerText = country.region;

        if (country.currencies) {
            currency.innerText = Object.values(country.currencies)[0].name
        }
        if (country.capital) {
            capital.innerText = country.capital;
        } else {
            capital.innerText = "N/A";
        }
        if (country.borders) {
            country.borders.forEach((border) => {
                fetch(`https://restcountries.com/v3.1/alpha/${border}`)
                    .then((response) => response.json())
                    .then(([borderCountry]) => {
                        const borderCountryTag = document.createElement("a")
                        borderCountryTag.innerText = borderCountry.name.common
                        borderCountryTag.href = `Country.html?name=${borderCountry.name.common}`
                        borderCountryContainer.append(borderCountryTag)
                    })
            })
        }

        languages.innerText = Object.values(country.languages).join(", ");
        subRegion.innerText = country.subregion;
        countryTopLevel.innerText = country.tld;

    });
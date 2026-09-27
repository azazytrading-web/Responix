import {saveData} from "./storage.js";
import {savePrayerTimesWithPlace, showPrayerTimes, loadOptions, showSavedStatus} from "./utils.js";

async function autocompletePlaces(input, suggestions, inputId) {
    const query = input.value.trim();
    if (query.length < 3) return;

    const endpoint = 'https://656cukssi8.execute-api.us-east-2.amazonaws.com/Prod/autocomplete';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ input: query }),
        });

        const data = await response.json();

        if (!data.suggestions) return;

        suggestions = data.suggestions.map(p => p.placePrediction.text.text);

        const datalistId = `${inputId}-datalist`;
        let datalist = document.getElementById(datalistId);

        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = datalistId;
            document.body.appendChild(datalist);
            input.setAttribute('list', datalistId);
        }

        datalist.innerHTML = '';
        suggestions.forEach(text => {
            const option = document.createElement('option');
            option.value = text;
            datalist.appendChild(option);
        });

        return suggestions;

    } catch (error) {
        console.error('Error calling autocomplete API:', error);
    }
}

export async function initLocationAutocompleteOnOptions() {
    const inputId = 'locationInput';
    const input = document.getElementById(inputId);
    if (!input) return;

    let suggestions = [];

    input.addEventListener('input', async () => {
        suggestions = await autocompletePlaces(input, suggestions, inputId);
    });

    input.addEventListener('change', async () => {
        const selected = input.value.trim();
        await saveData("place", selected);
        if (suggestions !== undefined && suggestions.includes(selected)) {
            const datalist = document.getElementById(`${inputId}-datalist`);
            if (datalist) {
                datalist.innerHTML = ''; // hide suggestions
            }
        }

        document.getElementById("optionsloader").style.visibility = "visible";

        await savePrayerTimesWithPlace(selected);

        document.getElementById("optionsloader").style.visibility = "hidden";

        showSavedStatus();

        await loadOptions();
    });
}

export async function initLocationAutocompleteOnPopup() {
    const inputId = 'locationInputPopup';
    const input = document.getElementById(inputId);
    if (!input) return;

    let suggestions = [];

    input.addEventListener('input', async () => {
        suggestions = await autocompletePlaces(input, suggestions, inputId);
    });

    function hideSettings() {
        document.querySelectorAll('.quicksettings').forEach(el => {
            el.style.display = 'none';
        });
    }

    input.addEventListener('change', async () => {
        const selected = input.value.trim();
        await saveData("place", selected);
        if (suggestions !== undefined && suggestions.includes(selected)) {
            const datalist = document.getElementById(`${inputId}-datalist`);
            if (datalist) {
                datalist.innerHTML = ''; // hide suggestions
            }
        }

        const container = document.getElementById("ptimes");
        let optionsLoader = document.getElementById("optionsloader");
        if (!optionsLoader) {
            optionsLoader = document.createElement('img');
            optionsLoader.id = "optionsloader";
            optionsLoader.src = "/loader.gif";
            optionsLoader.alt = "loading";
            optionsLoader.style.visibility = "hidden";
            container.appendChild(optionsLoader);
        }

        optionsLoader.style.visibility = "visible";

        await savePrayerTimesWithPlace(selected);

        optionsLoader.style.visibility = "hidden";

        await showPrayerTimes();

        // Hide settings
        hideSettings();
    });
}
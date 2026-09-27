import {loadData} from "./lib/storage.js";
import PrayerTimesAPI from "./lib/prayer-times-api.js";
import {ttphrases} from "./lib/constants.js"

async function initializeValues() {

    let place = await loadData("place");
    let pmethod = await loadData("pmethod");

    window.place = place;
    window.pmethod = pmethod;
    window.lang = lang;
}

async function saveLang() {

    const lang = document.getElementById('lang').value;

    document.title = ttphrases[0][lang];
    for (let i = 1; i < ttphrases.length; i++) {
        let elm = document.getElementsByClassName('phrase' + i)[0];
        if (!elm) continue; // Skip if no matching element

        if (elm.tagName.toLowerCase() === 'input') {
            elm.value = ttphrases[i][lang];
        } else {
            elm.innerHTML = ttphrases[i][lang];
        }
    }

    const dir = lang === "1" ? 'ltr' : 'rtl';
    document.documentElement.setAttribute('dir', dir);
    document.body.setAttribute('dir', dir);

    const elements = document.querySelectorAll('.engar');

    elements.forEach(el => {
        el.style.textAlign = lang === "0" ? 'left' : 'right';
    });
}

async function loadPrayerTimes(selectedMonth) {

    const date = new Date();

    const place = await loadData("place");

    let month = selectedMonth;
    if (selectedMonth === undefined || selectedMonth === null) {
        month = date.getMonth() + 1;
    }
    const year = date.getFullYear();
    const pmethod = await loadData('pmethod');
    const school = await loadData('HanfiShafi');

    const api = new PrayerTimesAPI();

    api.getMonthlyByAddress(place, month, year, pmethod, school)
        .then(data => loadMonthlyTable(data, month, year))
        .catch(err => console.error('Error:', err));

}

async function loadMonthlyTable(response, month, year) {
    if (!response || !response.data || !Array.isArray(response.data)) {
        console.error("Invalid response format");
        return;
    }

    var today = new Date();
    var dd = today.getDate();

    document.getElementById("yearmonth").innerHTML = month + "/" + year;

    if (month !== '') {
        const mSelect = document.getElementById("month");
        for (const option of mSelect.options) {
            if (option.value === String(month)) {
                option.selected = true;
                break;
            }
        }
    }

    let tbody = document.getElementById('monthlyprayer');
    for (var i = tbody.rows.length - 1; i > 0; i--) {
        tbody.deleteRow(i);
    }
    response.data.forEach((day, index) => {
        if (!day || !day.timings) return;

        let css;

        if (index === dd - 1) {
            css = "rowselected";
        } else {
            css = (index % 2 === 0) ? "odd" : "even";
        }

        const row = document.createElement("tr");

        // Day number (e.g., 1st, 2nd...)
        const dateCell = document.createElement("td");
        dateCell.textContent = index + 1;
        dateCell.className = css;
        row.appendChild(dateCell);

        // Extract and clean each required time (remove time zone part)
        const times = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
        times.forEach(prayer => {
            const cell = document.createElement("td");
            const fullTime = day.timings[prayer] || "-";
            // remove (EDT)
            cell.textContent = fullTime.split(" ")[0];
            cell.className = css;
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

function getVersion() {
    const manifest = chrome.runtime.getManifest();
    return manifest.version;
}

async function load() {

    await initializeValues();

    document.querySelectorAll('.nav2').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.advancedsettings').forEach(el => el.style.display = 'none');

    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    const versionSpan = document.getElementById("version");
    if (versionSpan) {
        versionSpan.textContent = "v" + getVersion();
    }

    // Load the saved lang
    let langSelect = document.getElementById("lang");
    for (const element of langSelect.children) {
        let child = element;
        if (child.value === await loadData('lang')) {
            child.selected = "true";
            break;
        }
    }

    await loadPrayerTimes();
    await saveLang();
}

document.addEventListener('DOMContentLoaded', load);
document.getElementById("month").addEventListener("change", async function () {
    const selectElement = this;
    const selectedMonth = selectElement.selectedIndex + 1;
    await loadPrayerTimes(selectedMonth);
}, false);
document.getElementById("lang").addEventListener("change", async function () {
    await saveLang();
}, false);
document.querySelector('#close').addEventListener('click', function () {
    window.close();
});
document.querySelector('#show').addEventListener('click', function () {
    document.querySelectorAll('.nav2').forEach(function (el) {
        if (el.style.display === 'none' || getComputedStyle(el).display === 'none') {
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    });
});
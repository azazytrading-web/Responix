/**
 * AlAdhan Prayer Times API Library
 * Complete wrapper for https://aladhan.com/prayer-times-api
 * Supports all endpoints including timings, calendar, and qibla direction
 */

export default class PrayerTimesAPI {
    constructor() {
        this.baseUrl = 'https://api.aladhan.com/v1';
        this.defaultMethod = 2; // Default calculation method (2 = ISNA)
    }


    /**
     * Fetch prayer times by address (free-form location string)
     * @param {string} address - Free-form address (e.g. "New York, USA")
     * @param {number} method - Optional calculation method (1-15)
     * @param {number} school - Optional school (0 = Shafi, 1 = Hanafi)
     * @param {string} x7xapikey - x7 api key
     * @param {string} date - Optional date (DD-MM-YYYY)
     * @returns {Promise<object>} Prayer times data
     */
    async getByAddress(address, method = null, school = null, x7xapikey = null, date = null) {
        const params = new URLSearchParams({
            address: encodeURIComponent(address),
        });

        if(x7xapikey !== null) params.append('x7xapikey', x7xapikey);
        if (method !== null) params.append('method', method);
        if (school !== null) params.append('school', school);
        if (date) params.append('date', date);

        return this._fetch(`/timingsByAddress?${params}`);
    }

    /**
     * Fetch prayer times by city
     * @param {string} city - City name
     * @param {string} country - Country name/code
     * @param {number} method - Calculation method (1-15, default: 2)
     * @param {number} hanafi - School Shafi = 0, Hanafi = 1
     * @param {string} date - Optional date (DD-MM-YYYY)
     * @returns {Promise<object>} Prayer times data
     */
    async getByCity(city, country, method, hanafi, date = null) {
        const params = new URLSearchParams({
            city: encodeURIComponent(city),
            country: encodeURIComponent(country),
            method: method,
            school: hanafi
        });

        if (date) params.append('date', date);

        return this._fetch(`/timingsByCity?${params}`);
    }

    /**
     * Fetch prayer times by coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} method - Calculation method (1-15, default: 2)
     * @param {string} date - Optional date (DD-MM-YYYY)
     * @returns {Promise<object>} Prayer times data
     */
    async getByCoords(lat, lng, method = this.defaultMethod, date = null) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lng,
            method: method
        });

        if (date) params.append('date', date);

        return this._fetch(`/timings?${params}`);
    }

    /**
     * Get monthly prayer times calendar by city
     * @param {string} city - City name
     * @param {string} country - Country name/code
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g. 2023)
     * @param {number} method - Calculation method (1-15, default: 2)
     * @returns {Promise<object>} Monthly calendar data
     */
    async getMonthlyByCity(city, country, month, year, method) {
        const params = new URLSearchParams({
            city: encodeURIComponent(city),
            country: encodeURIComponent(country),
            month: month,
            year: year,
            method: method
        });

        return this._fetch(`/calendarByCity?${params}`);
    }

    /**
     * Get monthly prayer times calendar by address
     * @param {string} address - Full address (e.g., "Los Angeles, CA, USA")
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g. 2025)
     * @param {number} method - Calculation method (1-15, default: 2)
     * @param {number} [school] - Optional: School of thought (0 = Shafi, 1 = Hanafi)
     * @returns {Promise<object>} Monthly calendar data
     */
    async getMonthlyByAddress(address, month, year, method , school) {
        const params = new URLSearchParams({
            address: address,
            month: month,
            year: year
        });

        if (method !== undefined) {
            params.append("method", method);
        }

        if (school !== undefined) {
            params.append("school", school);
        }

        return this._fetch(`/calendarByAddress?${params}`);
    }

    /**
     * Get monthly prayer times calendar by coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g. 2023)
     * @param {number} method - Calculation method (1-15, default: 2)
     * @returns {Promise<object>} Monthly calendar data
     */
    async getMonthlyByCoords(lat, lng, month, year, method = this.defaultMethod) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lng,
            month: month,
            year: year,
            method: method
        });

        return this._fetch(`/calendar?${params}`);
    }

    /**
     * Get Qibla direction from coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<object>} Qibla direction data
     */
    async getQiblaDirection(lat, lng) {
        return this._fetch(`/qibla/${lat}/${lng}`);
    }

    /**
     * Get current Islamic date
     * @param {string} adjustment - Optional adjustment days (-1 to 1)
     * @returns {Promise<object>} Islamic date data
     */
    async getIslamicDate(adjustment = 0) {
        return this._fetch(`/currentDate?adjustment=${adjustment}`);
    }

    /**
     * Get all calculation methods
     * @returns {Promise<object>} List of calculation methods
     */
    async getMethods() {
        return this._fetch('/methods');
    }

    /**
     * Internal fetch helper
     * @private
     */
    async _fetch(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('PrayerTimesAPI error:', error);
            throw error;
        }
    }
}

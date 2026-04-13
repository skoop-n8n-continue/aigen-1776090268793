/**
 * Weather App Logic
 * Powered by Open-Meteo API
 */

const CONFIG = {
    LOCATIONS: [
        { name: "Lahore, Pakistan", lat: 31.5204, lon: 74.3587 }
    ],
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutes
    ROTATION_INTERVAL: 15 * 1000,    // 15 seconds for snappier rotation
    REVERSE_GEO_API: "https://api.bigdatacloud.net/data/reverse-geocode-client"
};

const WEATHER_MAPPING = {
    0: { icon: "sun", label: "Clear Sky" },
    1: { icon: "cloud-sun", label: "Mainly Clear" },
    2: { icon: "cloud-sun", label: "Partly Cloudy" },
    3: { icon: "clouds", label: "Overcast" },
    45: { icon: "cloud-fog", label: "Fog" },
    48: { icon: "cloud-fog", label: "Depositing Rime Fog" },
    51: { icon: "cloud-drizzle", label: "Light Drizzle" },
    53: { icon: "cloud-drizzle", label: "Moderate Drizzle" },
    55: { icon: "cloud-drizzle", label: "Dense Drizzle" },
    56: { icon: "cloud-snow", label: "Light Freezing Drizzle" },
    57: { icon: "cloud-snow", label: "Dense Freezing Drizzle" },
    61: { icon: "cloud-rain", label: "Slight Rain" },
    63: { icon: "cloud-rain", label: "Moderate Rain" },
    65: { icon: "cloud-rain", label: "Heavy Rain" },
    66: { icon: "cloud-rain", label: "Light Freezing Rain" },
    67: { icon: "cloud-rain", label: "Heavy Freezing Rain" },
    71: { icon: "snowflake", label: "Slight Snowfall" },
    73: { icon: "snowflake", label: "Moderate Snowfall" },
    75: { icon: "snowflake", label: "Heavy Snowfall" },
    77: { icon: "snowflake", label: "Snow Grains" },
    80: { icon: "cloud-rain-wind", label: "Slight Rain Showers" },
    81: { icon: "cloud-rain-wind", label: "Moderate Rain Showers" },
    82: { icon: "cloud-rain-wind", label: "Violent Rain Showers" },
    85: { icon: "cloud-snow", label: "Slight Snow Showers" },
    86: { icon: "cloud-snow", label: "Heavy Snow Showers" },
    95: { icon: "cloud-lightning", label: "Thunderstorm" },
    96: { icon: "cloud-lightning", label: "Thunderstorm with Slight Hail" },
    99: { icon: "cloud-lightning", label: "Thunderstorm with Heavy Hail" }
};

// Fallback for missing codes
function getWeatherInfo(code) {
    return WEATHER_MAPPING[code] || { icon: "cloud", label: "Cloudy" };
}

/**
 * Main App Controller
 */
const App = {
    state: {
        locations: [...CONFIG.LOCATIONS],
        currentIndex: 0,
        weatherData: {}
    },

    async init() {
        console.log("Initializing Weather App...");
        this.updateClock();
        this.updateDate();
        setInterval(() => this.updateClock(), 1000 * 60);

        // Add current location if available
        await this.detectLocation();

        // Initial fetch
        await this.fetchAllWeather();

        // Auto-refresh weather data
        setInterval(() => this.fetchAllWeather(), CONFIG.REFRESH_INTERVAL);

        // Start rotation if multiple locations
        if (this.state.locations.length > 1) {
            setInterval(() => this.rotateLocation(), CONFIG.ROTATION_INTERVAL);
        }

        this.renderCurrentLocation();
    },

    async detectLocation() {
        return new Promise((resolve) => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        const name = await this.reverseGeocode(lat, lon);

                        // Check if already in list (simple lat/lon check or name check)
                        const exists = this.state.locations.some(loc =>
                            (Math.abs(loc.lat - lat) < 0.1 && Math.abs(loc.lon - lon) < 0.1)
                        );

                        if (!exists) {
                            this.state.locations.push({ name, lat, lon });
                        }
                        resolve();
                    },
                    (error) => {
                        console.warn("Geolocation failed:", error.message);
                        resolve();
                    },
                    { timeout: 5000 }
                );
            } else {
                resolve();
            }
        });
    },

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`${CONFIG.REVERSE_GEO_API}?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { cache: 'no-store' });
            const data = await response.json();
            return data.city || data.locality || data.principalSubdivision || "Current Location";
        } catch (error) {
            console.error("Reverse geocoding failed:", error);
            return "Current Location";
        }
    },

    async fetchAllWeather() {
        for (const loc of this.state.locations) {
            await this.fetchWeatherForLocation(loc);
        }
        this.renderCurrentLocation();
    },

    async fetchWeatherForLocation(loc) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&forecast_days=6&timezone=auto`;

        try {
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json();
            this.state.weatherData[loc.name] = data;
        } catch (error) {
            console.error(`Failed to fetch weather for ${loc.name}:`, error);
        }
    },

    rotateLocation() {
        const mainContent = document.querySelector('main');
        mainContent.classList.add('animate__fadeOut');

        setTimeout(() => {
            this.state.currentIndex = (this.state.currentIndex + 1) % this.state.locations.length;
            this.renderCurrentLocation();
            mainContent.classList.remove('animate__fadeOut');
            mainContent.classList.add('animate__fadeIn');
        }, 1000);
    },

    renderCurrentLocation() {
        const loc = this.state.locations[this.state.currentIndex];
        const data = this.state.weatherData[loc.name];

        if (!data) return;

        document.getElementById('location-name').textContent = loc.name;
        this.renderCurrent(data.current, data.daily);
        this.renderForecast(data.daily);
        this.updateLastUpdated();
    },

    renderCurrent(current, daily) {
        const info = getWeatherInfo(current.weather_code);

        // Update main temperature
        document.getElementById('current-temp').textContent = Math.round(current.temperature_2m);
        document.getElementById('weather-description').textContent = info.label;

        // Update icon
        const iconContainer = document.getElementById('weather-icon-large');
        iconContainer.innerHTML = `<i data-lucide="${info.icon}" style="width: 120px; height: 120px;"></i>`;

        // Update stats
        document.getElementById('stat-humidity').textContent = `${Math.round(current.relative_humidity_2m)}%`;
        document.getElementById('stat-wind').textContent = `${Math.round(current.wind_speed_10m)} km/h`;

        // Moon Phase calculation
        const moon = this.getMoonPhase(new Date());
        document.getElementById('stat-moon').textContent = moon.label;
        const moonIcon = document.getElementById('moon-icon');
        moonIcon.setAttribute('data-lucide', moon.icon);

        lucide.createIcons();
    },

    getMoonPhase(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        let c = 0, e = 0, jd = 0, b = 0;
        if (month < 3) { year--; month += 12; }
        month++;
        c = 365.25 * year;
        e = 30.6 * month;
        jd = c + e + day - 694039.09; // jd is total days elapsed
        jd /= 29.530588853; // divide by the lunar cycle
        b = parseInt(jd); // int(jd) -> b, our local variable
        jd -= b; // subtract integer part to leave fractional part of cycle
        b = Math.round(jd * 8); // scale fraction from 0-8 and round

        if (b >= 8) b = 0; // 0 and 8 are the same so wrap around

        const phases = [
            { label: 'New Moon', icon: 'moon' },
            { label: 'Waxing Crescent', icon: 'moon' },
            { label: 'First Quarter', icon: 'moon' },
            { label: 'Waxing Gibbous', icon: 'moon' },
            { label: 'Full Moon', icon: 'moon' },
            { label: 'Waning Gibbous', icon: 'moon' },
            { label: 'Last Quarter', icon: 'moon' },
            { label: 'Waning Crescent', icon: 'moon' }
        ];

        // Specific Lucide icons if available (Lucide has moon-star, etc. but simple moon works well with label)
        const lucideMoonIcons = ['moon', 'moon', 'moon', 'moon', 'moon', 'moon', 'moon', 'moon'];
        // Note: For simplicity and consistent design, I'll use the 'moon' icon for all, but can differentiate labels.

        return phases[b];
    },

    renderForecast(daily) {
        const list = document.getElementById('forecast-list');
        list.innerHTML = '';

        // Skip index 0 as it's today
        for (let i = 1; i < daily.time.length; i++) {
            const date = new Date(daily.time[i]);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const info = getWeatherInfo(daily.weather_code[i]);
            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);

            const item = document.createElement('div');
            item.className = 'forecast-item flex items-center justify-between group';
            item.innerHTML = `
                <span class="w-12 font-medium text-gray-300 group-hover:text-white transition-colors">${dayName}</span>
                <i data-lucide="${info.icon}" class="w-8 h-8 text-yellow-400"></i>
                <div class="flex items-center space-x-3 w-20 justify-end">
                    <span class="font-bold">${max}°</span>
                    <span class="text-gray-400 text-sm">${min}°</span>
                </div>
            `;
            list.appendChild(item);
        }

        lucide.createIcons();
    },

    updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('clock').textContent = timeStr;
    },

    updateDate() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        document.getElementById('current-date').textContent = dateStr;
    },

    updateLastUpdated() {
        const now = new Date();
        document.getElementById('last-updated').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());

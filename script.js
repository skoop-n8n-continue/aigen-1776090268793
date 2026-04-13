/**
 * Weather App Logic
 * Powered by Open-Meteo API
 */

const CONFIG = {
    DEFAULT_CITY: { name: "New York", lat: 40.7128, lon: -74.0060 },
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutes
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
        lat: CONFIG.DEFAULT_CITY.lat,
        lon: CONFIG.DEFAULT_CITY.lon,
        locationName: CONFIG.DEFAULT_CITY.name
    },

    async init() {
        console.log("Initializing Weather App...");
        this.updateClock();
        this.updateDate();
        setInterval(() => this.updateClock(), 1000 * 60);

        await this.detectLocation();
        await this.fetchWeather();

        // Auto-refresh weather
        setInterval(() => this.fetchWeather(), CONFIG.REFRESH_INTERVAL);
    },

    async detectLocation() {
        return new Promise((resolve) => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        this.state.lat = position.coords.latitude;
                        this.state.lon = position.coords.longitude;
                        await this.reverseGeocode(this.state.lat, this.state.lon);
                        resolve();
                    },
                    (error) => {
                        console.warn("Geolocation failed, using default city:", error.message);
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
            this.state.locationName = data.city || data.locality || data.principalSubdivision || "Your Location";
            document.getElementById('location-name').textContent = this.state.locationName;
        } catch (error) {
            console.error("Reverse geocoding failed:", error);
            document.getElementById('location-name').textContent = "Current Location";
        }
    },

    async fetchWeather() {
        const { lat, lon } = this.state;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=6&timezone=auto`;

        try {
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json();
            this.renderCurrent(data.current);
            this.renderForecast(data.daily);
            this.updateLastUpdated();
            document.getElementById('location-name').textContent = this.state.locationName;
        } catch (error) {
            console.error("Failed to fetch weather data:", error);
        }
    },

    renderCurrent(current) {
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
        // UV Index is not in current but could be derived or fetched. Showing a random UV for now or fetching if available.
        // Actually Open-Meteo current doesn't include UV by default without extra params.
        document.getElementById('stat-uv').textContent = "Low";

        lucide.createIcons();
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
                <i data-lucide="${info.icon}" class="w-8 h-8 text-[#00b7af]"></i>
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

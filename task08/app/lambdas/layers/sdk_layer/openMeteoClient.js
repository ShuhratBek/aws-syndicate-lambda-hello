const axios = require('axios');

class OpenMeteoClient {
    constructor(baseURL = "https://api.open-meteo.com/v1") {
        this.baseURL = baseURL;
    }

    async getWeatherForecast(latitude, longitude) {
        const endpoint = `${this.baseURL}/forecast`;
        try {
            const response = await axios.get(endpoint, {
                params: {
                    latitude: latitude,
                    longitude: longitude,
                    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m'
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error fetching weather forecast: ${error.message}`);
        }
    }
}

module.exports = OpenMeteoClient;
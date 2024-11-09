const OpenMeteoClient = require('/opt/nodejs/node_modules/openMeteoClient'); // Path where Lambda layers are mounted

exports.handler = async (event) => {
    console.log(JSON.stringify(event));
    // Example coordinates for Kyiv
    const latitude = 50.4375;
    const longitude = 30.5;

    const client = new OpenMeteoClient();

    try {
        const forecast = await client.getWeatherForecast(latitude, longitude);
        return {
            statusCode: 200,
            body: JSON.stringify(forecast),
        };
    } catch (error) {
        console.error('Error getWeatherForecast:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
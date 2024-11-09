const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
// Enable X-Ray tracing
const AWSXRay = require('aws-xray-sdk');
const AWSWithXRay = AWSXRay.captureAWS(AWS);

const dynamoDb = new AWSWithXRay.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const latitude = 50.4375;
    const longitude = 30.5;

    try {
        // Fetch weather data from Open-Meteo API
        const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: latitude,
                longitude: longitude,
                hourly: 'temperature_2m'
            }
        });

        const forecastData = response.data;

        // Format data to fit the DynamoDB schema
        const item = {
            id: uuidv4(),
            forecast: {
                elevation: forecastData.elevation,
                generationtime_ms: forecastData.generationtime_ms,
                hourly: {
                    temperature_2m: forecastData.hourly.temperature_2m,
                    time: forecastData.hourly.time
                },
                hourly_units: forecastData.hourly_units,
                latitude: forecastData.latitude,
                longitude: forecastData.longitude,
                timezone: forecastData.timezone,
                timezone_abbreviation: forecastData.timezone_abbreviation,
                utc_offset_seconds: forecastData.utc_offset_seconds,
            }
        };

        // Put the weather data into DynamoDB table
        await dynamoDb.put({
            TableName: 'Weather',
            Item: item
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Weather data stored successfully', item })
        };
    } catch (error) {
        console.error('Error fetching or storing weather data:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch or store weather data' })
        };
    }
};
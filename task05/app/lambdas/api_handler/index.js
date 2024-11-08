const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const tableName = 'Events'; // Ensure this matches your DynamoDB table name

    try {
        // Parse the request body to get the incoming data
        const { principalId, content } = JSON.parse(event.body);

        // Generate a unique ID for the new event entry using crypto
        const eventId = crypto.randomUUID();

        // Construct the event data to save in DynamoDB
        const eventData = {
            id: eventId,
            principalId: principalId,
            createdAt: new Date().toISOString(),
            body: content,
        };

        // Parameters for the DynamoDB put operation
        const params = {
            TableName: tableName,
            Item: eventData,
        };

        // Save the event data to DynamoDB
        await dynamoDb.put(params).promise();

        // Return the created event as a response with status code 201
        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'Event created successfully',
                event: eventData,
            }),
        };
    } catch (error) {
        console.error('Error processing event:', error);

        // Return a response in case of an error
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'An error occurred',
                error: error.message,
            }),
        };
    }
};
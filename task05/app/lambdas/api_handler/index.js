const AWS = require('aws-sdk');
const uuid = require('uuid');

const region = process.env.region || "eu-central-1";// Defaulting to "eu-central-1" if region is not available in environment variables.
const dynamoDb = new AWS.DynamoDB.DocumentClient({region});

exports.handler = async (event) => {
    const tableName = process.env.target_table
    console.log('event', JSON.stringify(event));

    try {
        const { principalId, content } = event;

        // Generate a unique ID for the new event entry
        const eventId = uuid.v4();

        // Construct the event data to save in DynamoDB
        const eventData = {
            id: eventId,
            principalId,
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
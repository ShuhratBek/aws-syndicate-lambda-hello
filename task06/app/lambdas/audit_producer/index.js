const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const auditTableName = 'Audit';

    try {
        // Process each record from the DynamoDB stream
        for (const record of event.Records) {
            switch (record.eventName) {
                case 'INSERT':
                    await handleInsert(record.dynamodb.NewImage);
                    break;
                case 'MODIFY':
                    await handleModify(record.dynamodb.OldImage, record.dynamodb.NewImage);
                    break;
            }
        }
    } catch (error) {
        console.error('Error processing DynamoDB stream:', error);
    }

    async function handleInsert(newImage) {
        // Unmarshall DynamoDB item to JavaScript object
        const newItem = AWS.DynamoDB.Converter.unmarshall(newImage);

        const auditEntry = {
            id: uuidv4(),
            itemKey: newItem.key,
            modificationTime: new Date().toISOString(),
            newValue: newItem,
        };

        // Save the audit entry to the Audit table
        await dynamoDb.put({
            TableName: auditTableName,
            Item: auditEntry,
        }).promise();

        console.log('Audit entry for insert:', auditEntry);
    }

    async function handleModify(oldImage, newImage) {
        // Unmarshall DynamoDB items to JavaScript objects
        const oldItem = AWS.DynamoDB.Converter.unmarshall(oldImage);
        const newItem = AWS.DynamoDB.Converter.unmarshall(newImage);

        // Determine changed attributes
        for (const key of Object.keys(newItem)) {
            if (oldItem[key] !== newItem[key]) {
                const auditEntry = {
                    id: uuidv4(),
                    itemKey: newItem.key,
                    modificationTime: new Date().toISOString(),
                    updatedAttribute: key,
                    oldValue: oldItem[key],
                    newValue: newItem[key],
                };

                // Save the audit entry to the Audit table
                await dynamoDb.put({
                    TableName: auditTableName,
                    Item: auditEntry,
                }).promise();

                console.log('Audit entry for modification:', auditEntry);
            }
        }
    }
};
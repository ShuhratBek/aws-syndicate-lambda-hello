const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const { v4: uuidv4 } = require('uuid');

const region = process.env.region || "eu-central-1";// Defaulting to "eu-central-1" if region is not available in environment variables.
const dynamoDb = new AWS.DynamoDB.DocumentClient({ region });

const tablesTable = process.env.tables_table;
const reservationsTable = process.env.reservations_table;

exports.handler = async (event) => {
    const routeKey = `${event.httpMethod} ${event.resource}`;
    try {
        switch(routeKey) {
            case 'POST /signup':
                return await handleSignUp(event);
            case 'POST /signin':
                return await handleSignIn(event);
            case 'POST /tables':
                return await createTable(event);
            case 'GET /tables':
                return await listTables(event);
            case 'GET /tables/{tableId}':
                return await getTable(event);
            case 'POST /reservations':
                return await createReservation(event);
            case 'GET /reservations':
                return await listReservations(event);
            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Unsupported route' })
                };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Sign-up a new user
async function handleSignUp(event) {
    const body = JSON.parse(event.body);
    const params = {
        UserPoolId: process.env.USER_POOL_ID,
        Username: body.email,
        UserAttributes: [
            { Name: 'email', Value: body.email },
            { Name: 'name', Value: `${body.firstName} ${body.lastName}` }
        ],
        TemporaryPassword: body.password,
    };

    try {
        await cognito.adminCreateUser(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Sign-up successful" })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// Sign in a user
async function handleSignIn(event) {
    const body = JSON.parse(event.body);
    const params = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.APP_CLIENT_ID,
        AuthParameters: {
            USERNAME: body.email,
            PASSWORD: body.password
        }
    };

    try {
        const authResult = await cognito.initiateAuth(params).promise();
        const idToken = authResult.AuthenticationResult.IdToken;
        return {
            statusCode: 200,
            body: JSON.stringify({ accessToken: idToken })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// Create a new table
async function createTable(event) {
    const body = JSON.parse(event.body);
    const params = {
        TableName: tablesTable,
        Item: {
            id: body.id,
            number: body.number,
            places: body.places,
            isVip: body.isVip,
            minOrder: body.minOrder || null
        }
    };

    try {
        await dynamoDb.put(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ id: body.id })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// List all tables
async function listTables() {
    const params = {
        TableName: tablesTable
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ tables: data.Items })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// Get a specific table
async function getTable(event) {
    const tableId = event.pathParameters.tableId;
    const params = {
        TableName: tablesTable,
        Key: { id: parseInt(tableId) }
    };

    try {
        const data = await dynamoDb.get(params).promise();
        if (data.Item) {
            return { statusCode: 200, body: JSON.stringify(data.Item) };
        } else {
            return { statusCode: 404, body: JSON.stringify({ error: "Table not found" }) };
        }
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// Create a new reservation
async function createReservation(event) {
    const body = JSON.parse(event.body);
    const reservationId = uuidv4();

    const params = {
        TableName: reservationsTable,
        Item: {
            reservationId: reservationId,
            tableNumber: body.tableNumber,
            clientName: body.clientName,
            phoneNumber: body.phoneNumber,
            date: body.date,
            slotTimeStart: body.slotTimeStart,
            slotTimeEnd: body.slotTimeEnd
        }
    };

    try {
        await dynamoDb.put(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ reservationId })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

// List all reservations
async function listReservations() {
    const params = {
        TableName: reservationsTable
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ reservations: data.Items })
        };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}
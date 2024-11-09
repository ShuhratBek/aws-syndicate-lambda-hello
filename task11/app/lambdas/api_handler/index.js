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
                return jsonResponse(400,{ error: 'Unsupported route' });
        }
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
    }
};

async function getUserPoolIdByName(userPoolName) {
    const params = {
        MaxResults: 60 // maximum allowed is 60
    };

    try {
        const listUserPools = await cognito.listUserPools(params).promise();
        const userPool = listUserPools.UserPools.find(pool => pool.Name === userPoolName);

        if (!userPool) {
            throw new Error(`User Pool Name ${userPoolName} not found.`);
        }

        return userPool.Id;
    } catch (error) {
        console.error("Error retrieving User Pool ID:", error.message);
        throw new Error('Failed to get User Pool ID.');
    }
}

async function setPasswordForUser(username, userPoolId, clientId, challengeName, session, newPassword) {
    const challengeParams = {
        ChallengeName: challengeName,
        ClientId: clientId,
        UserPoolId: userPoolId,
        ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: newPassword
        },
        Session: session
    };

    try {
        await cognito.adminRespondToAuthChallenge(challengeParams).promise();
        console.log('Password set successfully');
    } catch (error) {
        console.error('Error setting password:', error.message);
        throw new Error('Failed to set password');
    }
}

async function authenticateTemporaryUser(username, temporaryPassword, userPoolId, clientId) {
    const authParams = {
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: temporaryPassword
        }
    };

    try {
        const response = await cognito.adminInitiateAuth(authParams).promise();
        return response;
    } catch (error) {
        if (error.code === 'PasswordResetRequiredException') {
            console.log('Password reset required');
            return error.response;
        }
        console.error('Error during temporary authentication:', error.message);
        throw new Error('Authentication failed');
    }
}

// Sign-up a new user
async function handleSignUp(event) {
    const body = JSON.parse(event.body);
    const username = body.email;
    const temporaryPassword = 'TemporaryPassword123!';
    const newPassword = body.password;

    try {
        const userPoolId = await getUserPoolIdByName(process.env.booking_userpool);
        const clientId = await getAppClientIdByName(userPoolId, process.env.client_name);
        const params = {
            UserPoolId: userPoolId,
            Username: body.email,
            UserAttributes: [
                { Name: 'email', Value: body.email },
                { Name: 'name', Value: `${body.firstName} ${body.lastName}` },
                { Name: 'email_verified', Value: 'true' }
            ],
            TemporaryPassword: temporaryPassword,
            MessageAction: 'SUPPRESS', // Optional: Suppress invitation email
        };
        console.log(`Found userPoolId: ${userPoolId}`);

        await cognito.adminCreateUser(params).promise();
        const authResponse = await authenticateTemporaryUser(username, temporaryPassword, userPoolId, clientId);

        if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            await setPasswordForUser(username, userPoolId, clientId, authResponse.ChallengeName, authResponse.Session, newPassword);
        }
        return jsonResponse(200,{ message: "Sign-up successful" });
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
    }
}

async function getAppClientIdByName(userPoolId, clientName) {
    try {
        // List all app clients for the specified user pool
        const listAppClientsResponse = await cognito.listUserPoolClients({
            UserPoolId: userPoolId,
            MaxResults: 60 // You may adjust this as needed
        }).promise();

        // Find the client that matches the desired name
        const appClient = listAppClientsResponse.UserPoolClients.find(client => client.ClientName === clientName);

        if (!appClient) {
            throw new Error(`Client Name ${clientName} not found in User Pool ${userPoolId}.`);
        }

        return appClient.ClientId;

    } catch (error) {
        console.error("Error retrieving App Client ID:", error.message);
        throw new Error('Failed to get App Client ID.');
    }
}

// Sign in a user
async function handleSignIn(event) {
    const body = JSON.parse(event.body);

    try {
        const userPoolId = await getUserPoolIdByName(process.env.booking_userpool);
        const clientId = await getAppClientIdByName(userPoolId, process.env.client_name);
        const params = {
            AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
            UserPoolId: userPoolId,
            ClientId: clientId,
            AuthParameters: {
                USERNAME: body.email,
                PASSWORD: body.password
            }
        };

        console.log(`Found clientId: ${clientId}`);

        const authResult = await cognito.adminInitiateAuth(params).promise();
        const idToken = authResult.AuthenticationResult.IdToken;
        return jsonResponse(200,{ accessToken: idToken });
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
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
        return jsonResponse(200,{ id: body.id });
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
    }
}

// List all tables
async function listTables() {
    const params = {
        TableName: tablesTable
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        return jsonResponse(200,{ tables: data.Items });
    } catch (error) {
        console.error(error);
        return jsonResponse(400,{ error: error.message });
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
            return jsonResponse(200, data.Item);
        } else {
            return jsonResponse(404, { error: "Table not found" });
        }
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
    }
}
// Check if a table exists in the 'Tables' table
async function checkTableByNumber(tableNumber) {
    const params = {
        TableName: tablesTable,
        FilterExpression: '#num = :tableNumber',
        ExpressionAttributeNames: {
            '#num': 'number',
        },
        ExpressionAttributeValues: {
            ':tableNumber': tableNumber,
        },
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        return data.Items && data.Items.length > 0;
    } catch (error) {
        console.error('Error checking table existence by number:', error);
        throw new Error('Error checking table existence.');
    }
}

// Function to check for overlapping reservations
async function checkForOverlappingReservations(tableNumber, date, slotTimeStart, slotTimeEnd) {
    const params = {
        TableName: reservationsTable,
        FilterExpression: '#tableNum = :tableNumber AND #d = :date',
        ExpressionAttributeNames: {
            '#tableNum': 'tableNumber',
            '#d': 'date'
        },
        ExpressionAttributeValues: {
            ':tableNumber': tableNumber,
            ':date': date
        }
    };

    try {
        const data = await dynamoDb.scan(params).promise();

        for (const reservation of data.Items) {
            if (isTimeOverlap(slotTimeStart, slotTimeEnd, reservation.slotTimeStart, reservation.slotTimeEnd)) {
                return jsonResponse(400, { error: 'Overlapping reservation exists' });
            }
        }

        return null; // No overlapping reservations
    } catch (error) {
        console.error('Error scanning for overlapping reservations:', error);
        throw new Error('Error checking for overlapping reservations.');
    }
}

// Utility function to determine if time intervals overlap
function isTimeOverlap(start1, end1, start2, end2) {
    const [s1, e1] = [parseTime(start1), parseTime(end1)];
    const [s2, e2] = [parseTime(start2), parseTime(end2)];

    return (s1 < e2 && s2 < e1);
}

// Utility function to parse "HH:MM" time to a number for comparisons
function parseTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Create a new reservation
async function createReservation(event) {
    const body = JSON.parse(event.body);
    console.log(body);
    const { tableNumber, date, slotTimeStart, slotTimeEnd } = body;

    if (!tableNumber || !date || !slotTimeStart || !slotTimeEnd) {
        return jsonResponse(400, { error: 'Missing required reservation data' });
    }

    // Check if the table exists
    const tableExists = await checkTableByNumber(tableNumber);
    if (!tableExists) {
        return jsonResponse(400, { error: 'Table does not exist' });
    }

    // Check for overlapping reservations
    const overlapErrorResponse = await checkForOverlappingReservations(tableNumber, date, slotTimeStart, slotTimeEnd);
    if (overlapErrorResponse) {
        return overlapErrorResponse;
    }

    try {
        const reservationId = uuidv4();
        await dynamoDb.put({
            TableName: reservationsTable,
            Item: {
                id: reservationId,
                ...body
            }
        }).promise();

        return jsonResponse(200, { reservationId });
    } catch (error) {
        console.error(error);
        return jsonResponse(500, { error: 'Could not process reservation' });
    }
}

// List all reservations
async function listReservations() {
    const params = {
        TableName: reservationsTable
    };

    try {
        const data = await dynamoDb.scan(params).promise();
        return jsonResponse(200, { reservations: data.Items });
    } catch (error) {
        console.error(error);
        return jsonResponse(400, { error: error.message });
    }
}

// Utility function to standardize JSON responses with CORS headers
function jsonResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Accept-Version": "*"
        },
        body: JSON.stringify(body)
    };
}
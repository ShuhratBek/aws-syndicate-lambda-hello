exports.handler = async (event) => {
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify({
            "statusCode": 200,
            "message": "Hello from Lambda"
        }),
    };
    return response;
};

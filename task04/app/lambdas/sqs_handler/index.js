exports.handler = async (event) => {
    // Loop through each record in the event
    event.Records.forEach(record => {
        // Log the message body to CloudWatch
        console.log('SQS Message Body:', record.body);
    });

    return {
        statusCode: 200,
        body: JSON.stringify('Messages processed successfully'),
    };
};

exports.handler = async (event) => {
    // Loop through each SNS record in the event
    event.Records.forEach(record => {
        // Extract the SNS message from the record
        const snsMessage = record.Sns;

        // Log the message content to CloudWatch Logs
        console.log('SNS Message ID:', snsMessage.MessageId);
        console.log('SNS Message:', snsMessage.Message);
    });

    return {
        statusCode: 200,
        body: JSON.stringify('Messages processed successfully'),
    };
};

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const region = process.env.region || "eu-central-1";// Defaulting to "eu-central-1" if region is not available in environment variables.
const s3 = new AWS.S3({region});

exports.handler = async () => {
    try {
        const bucketName = process.env.target_bucket;
        // Generate an array of 10 random UUIDs
        const ids = Array.from({ length: 10 }, () => uuidv4());

        // Get the current timestamp in ISO 8601 format
        const timestamp = new Date().toISOString();

        // Define the content to be stored in S3
        const content = JSON.stringify({ ids }, null, 2);

        // Define the name of the file to be stored in S3
        const fileName = `${timestamp}.json`;

        // Define the bucket name and parameters for S3
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: content,
            ContentType: 'application/json'
        };

        // Upload the file to S3
        await s3.putObject(params).promise();

        console.log(`Successfully stored UUIDs in S3 bucket: ${fileName}`);

    } catch (error) {
        console.error('Error generating UUIDs or storing in S3:', error);
        throw new Error('Failed to generate UUIDs or store in S3');
    }
};
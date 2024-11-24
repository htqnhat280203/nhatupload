const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const formidable = require("formidable");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.S3_REGION;
const Bucket = process.env.S3_BUCKET;
const DynamoDBTable = process.env.DYNAMODB_TABLE; // Specify your DynamoDB table name

const fileparser = (req) => {
  return new Promise((resolve, reject) => {
    const options = {
      maxFileSize: 100 * 1024 * 1024, // 100 MB
      allowEmptyFiles: false,
    };

    const form = formidable(options);
    const uploadPromises = [];

    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const dynamoDBClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    form.on("file", (formName, file) => {
      const fileKey = `${uuidv4()}-${file.originalFilename}`;

      const uploadPromise = new Upload({
        client: s3Client,
        params: {
          Bucket,
          Key: fileKey,
          Body: file.filepath ? fs.createReadStream(file.filepath) : file,
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      })
        .done()
        .then(async (data) => {
          // Add metadata to DynamoDB after successful upload
          const fileMetadata = {
            TableName: DynamoDBTable,
            Item: {
              [process.env.PARTITION_KEY]: { S: `${file.originalFilename}` }, // Partition Key
              FileKey: { S: `${Date.now()}-${file.originalFilename}` }, // Tên tệp động
              FileName: { S: file.originalFilename }, // Tên tệp động
              UploadTime: { S: new Date().toISOString() }, // Thời gian tải lên động
              FileSize: { N: `${file.size}` }, // Kích thước tệp động
              Bucket: { S: Bucket }, // Bucket từ .env (tĩnh)
              S3Location: { S: data.Location }, // URL S3 từ phản hồi (động)
            },
          };

          try {
            await dynamoDBClient.send(new PutItemCommand(fileMetadata));
          } catch (dynamoError) {
            console.error("Error saving metadata to DynamoDB:", dynamoError);
            throw dynamoError;
          }

          return data;
        })
        .catch((err) => {
          console.error("Upload error:", err);
          throw err;
        });

      uploadPromises.push(uploadPromise);
    });

    form.on("end", async () => {
      try {
        const results = await Promise.all(uploadPromises);
        resolve(results);
      } catch (err) {
        reject(err);
      }
    });

    form.on("error", (err) => {
      reject(err);
    });

    form.parse(req);
  });
};

module.exports = fileparser;

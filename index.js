const express = require("express");
const app = express();
require("dotenv").config();
const formidable = require("formidable");
const fileparser = require("./fileparser");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

app.set("json spaces", 5); // To prettify JSON response

const PORT = process.env.PORT || 3000;

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.get("/", async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
    });
    const data = await s3Client.send(command);
    const files = data.Contents?.map((item) => item.Key) || [];

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Upload</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f8f9fa;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px 60px;
            border-radius: 10px;
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
            width: 80%;
            max-width: 600px;
          }
          h2 {
            font-size: 28px;
            color: #333;
            margin-bottom: 30px;
          }
          label {
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            display: inline-block;
            margin-bottom: 20px;
          }
          input[type="file"] {
            display: none;
          }
          #file-chosen {
            display: block;
            margin-top: 10px;
            font-size: 14px;
            color: #555;
          }
          input[type="submit"] {
            padding: 12px 24px;
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
          }
          input[type="submit"]:hover {
            background-color: #218838;
          }
          .file-list {
            margin-top: 30px;
            text-align: left;
          }
          .file-list h3 {
            margin-bottom: 10px;
            color: #333;
          }
          .file-list p {
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Upload a File</h2>
          <form action="/api/upload" enctype="multipart/form-data" method="post">
            <div>
              <label for="file">Choose a File:</label>
              <input type="file" id="file" name="file" multiple="multiple" />
              <span id="file-chosen">No file chosen</span>
            </div>
            <input type="submit" value="Upload">
          </form>
          <div class="file-list">
            <h3>Files List</h3>
            ${
              files.length > 0
                ? files.map((file) => `<p>${file}</p>`).join("")
                : "<p>No files uploaded yet.</p>"
            }
          </div>
        </div>
        <script>
          const fileInput = document.getElementById('file');
          const fileChosen = document.getElementById('file-chosen');

          fileInput.addEventListener('change', () => {
            const fileList = Array.from(fileInput.files).map(file => file.name).join(', ');
            fileChosen.textContent = fileList || "No file chosen";
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error fetching file list:", err);
    res.status(500).send("An error occurred while fetching the file list.");
  }
});

app.post("/api/upload", async (req, res) => {
  try {
    await fileparser(req);
    res.redirect("/");
  } catch (error) {
    console.error("Error in file upload:", error);
    res.status(400).json({
      message: "An error occurred.",
      error: error.message || "Unknown error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}.`);
});

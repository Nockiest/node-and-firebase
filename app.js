const express = require("express");
const multer = require('multer');
const admin = require("firebase-admin");
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getDownloadURL, ref } = require('firebase/storage');
var serviceAccount = require("./config.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "fileshraingapp.appspot.com"
  });
 
const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const db = admin.firestore();
const filesCollection = db.collection("files");
const storageRef = admin.storage().bucket();

const bucket = admin.storage().bucket();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', 'ejs');

const formHTML = `
<form class="add-form" method="POST" action="/add" enctype="multipart/form-data">
        <label for="filename">Filename:</label>
        <input type="text" id="filename" name="filename" required>
        <label for="user">User:</label>
        <input type="text" id="user" name="user" required>
        <label for="file">File:</label>
        <input type="file" id="file" name="file" required>
        <label for="description">Description:</label>
        <textarea id="description" name="description"></textarea>
        <input type="submit" value="Upload">
        
      </form>
`;

 
app.get('/', async (req, res) => {
  try {
    const files = [];
    const [filesResponse] = await storageRef.getFiles({ prefix: 'files/' });
    
    for (const file of filesResponse) {
      const [metadata] = await file.getMetadata();
      const downloadURL = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2500' // Adjust the expiry date as needed
      });

      files.push({
        filename: metadata.name,
        user: metadata.metadata.user,
        downloadURL: downloadURL[0]
      });
    }

    // Generate the HTML content dynamically
    let htmlContent = `
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My File Gallery</title>
        <!-- Add your custom CSS styles here -->
        <style>
          /* Styles omitted for brevity */
        </style>
      </head>
      <body>
        <nav>
          <ul>
            <li><a href="#">My Files</a></li>
            <li><a href="#">Browse Files</a></li>
            <li><a href="#">App Info</a></li>¨
            <li><a href="gallery">App Info</a></li>
          </ul>
        </nav>

        <div class="gallery">
          ${files.map(file => `
            <div class="file-item">
              <h3>${file.filename}</h3>
              <p>User: ${file.user}</p>
              <a href="${file.downloadURL}" target="_blank">Download</a>
            </div>
          `).join('')}
        </div>

        <div class="file-form">
          <h2>Add New File</h2>
         ${formHTML}
        </div>

        <!-- Add your custom JavaScript code here -->

      </body>
      </html>
    `;

    // Send the dynamically generated HTML content as the response
    res.send(htmlContent);
  } catch (error) {
    res.status(500).send(error);
  }
});
 
app.get("/gallery", async (req, res) => {
  try {
    const files = [];
    const [filesResponse] = await storageRef.getFiles({ prefix: 'files/' });

    if (filesResponse[0].name === "files/") {
      filesResponse.shift(); // Remove the first file
    }

    for (const file of filesResponse) {
      const [metadata] = await file.getMetadata();
      const downloadURL = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2500' // Adjust the expiry date as needed
      });

      console.log(metadata.name, downloadURL[0]);

      files.push({
        filename: metadata.name,
        downloadURL: downloadURL[0]
      });
    }

    // Log the files to the console
    console.log("Files:");
    files.forEach(file => {
      console.log(file);
    });

    // Generate the HTML content dynamically
    let htmlContent = `
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Gallery</title>
        <style>
          .gallery {
            display: flex;
            flex-wrap: wrap;
          }
          .image-container {
            position: relative;
            flex: 0 0 25%;
            margin: 10px;
          }
          .image-container img {
            width: 100%;
            height: auto;
            cursor: pointer;
          }
          .delete-icon {
            position: absolute;
            top: 5px;
            right: 5px;
            font-size: 20px;
            color: red;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h1>File Gallery</h1>
        <div class="gallery">
    `;

    files.forEach(file => {
      htmlContent += `
          <div class="image-container">
            <h3>${file.filename}</h3>
            <a href="${file.downloadURL}" download="${file.filename}">
              <img src="${file.downloadURL}" alt="${file.filename}">
            </a>
            <span class="delete-icon" onclick="deleteFile('${file.filename}')">&#10060;</span>
          </div>
      `;
    });

    htmlContent += `
     ${formHTML}
        </div>
        <script>
          function deleteFile(filename) {
            if (confirm('Are you sure you want to delete this file?')) {
              // Perform the delete operation using an AJAX request or your preferred method
              // Example AJAX request:
              fetch('/delete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename: filename })
              })
              .then(response => {
                if (response.ok) {
                  // File deleted successfully, you can reload the gallery or update it dynamically
                  location.reload();
                } else {
                  // Error occurred during file deletion
                  console.error('Error deleting file:', response.statusText);
                }
              })
              .catch(error => {
                console.error('Error deleting file:', error);
              });
            }
          }
        </script>
      </body>
      </html>
    `;

    res.send(htmlContent); // Send the dynamically generated HTML content as the response
  } catch (error) {
    console.error("Error fetching image URLs:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post('/add', upload.single('file'), async (req, res) => {
    try {
      const { filename, user } = req.body;
      const file = req.file;
  
      // Check if a file with the same filename already exists
      const existingFiles = await bucket.getFiles({
        prefix: `files/${filename}`
      });
  
      if (existingFiles[0].length > 0) {
        return res.status(400).send('File with the same filename already exists');
      }
  
      // Generate a unique filename using UUID
      const uniqueFilename = `${uuidv4()}_${filename}_${user}`;
  
      // Upload the file to Firebase Storage
      const blob = bucket.file(`files/${uniqueFilename}`);
      const blobStream = blob.createWriteStream();
  
      blobStream.on('error', (err) => {
        console.error('Error uploading file:', err);
        return res.status(500).send('Internal Server Error');
      });
  
      blobStream.on('finish', async () => {
        // Get the download URL of the uploaded file
        const downloadURL = await blob.getSignedUrl({
          action: 'read',
          expires: '03-01-2500' // Adjust the expiry date as needed
        });
  
        // Save the file details in Firestore or perform any other required operations
        // ...
        
        return res.status(200).send(`File added successfully with URL: ${downloadURL}`);
      });
  
      blobStream.end(file.buffer);
    } catch (error) {
      console.error('Error adding file:', error);
      return res.status(500).send('Internal Server Error');
    }
  });

  async function listFiles() {
    try {
      const [files] = await admin.storage().bucket().getFiles({
        prefix: "files/"
      });
  
      console.log("Files in the folder:");
      files.forEach(file => {
        console.log(file.name);
      });
    } catch (error) {
      console.error("Error listing files:", error);
    }
  }
  
  // Call the function to list files
  listFiles();
  

  // app.get('/', async (req, res) => {
//     try {
//         let response = [];

//         const querySnapshot = await filesCollection.get();
//         querySnapshot.forEach((doc) => {
//             response.push(doc.data());
//         });

//         // Render the "index.ejs" file and pass the response data to it
//         res.render('index', { files: response });
//     } catch (error) {
//         res.status(500).send(error);
//     }
// });

 
  
// Serve static files from the "public" directory
 
// app.get("/", async (req, res) => {
//   try {
//     let response = [];

//     const querySnapshot = await filesCollection.get();
//     querySnapshot.forEach((doc) => {
//       response.push(doc.data());
//     });
//     return  res.sendFile('index.html', { root: './public' });
//     // return res.status(200).send(response);
//   } catch (error) {
//     return res.status(500).send(error);
//   }
// });

  app.put('/update', async (req, res) => {
    try {
      const { user, filename, contents } = req.body;
  
      // Query the collection to find the file with matching username and filename
      const querySnapshot = await filesCollection
        .where('user', '==', user)
        .where('filename', '==', filename)
        .get();
  
      if (querySnapshot.empty) {
        return res.status(404).send('File not found');
      }
  
      // Update the contents of the first matching document
      const fileDoc = querySnapshot.docs[0];
      await fileDoc.ref.update({ contents });
  
      return res.status(200).send('File updated successfully');
    } catch (error) {
      console.error('Error updating file:', error);
      return res.status(500).send('Internal Server Error');
    }
  });

  app.delete('/delete', async (req, res) => {
    try {
      const { user, filename } = req.body;
      console.log(user, filename);
  
      // Find the document(s) matching the provided username and filename
      const querySnapshot = await filesCollection
        .where('user', '==', user)
        .where('filename', '==', filename)
        .get();
  
      // Check if any matching document(s) were found
      if (querySnapshot.empty) {
        return res.status(404).send('File not found');
      }
  
      // Delete the matching document(s)
      const deletePromises = querySnapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(deletePromises);
  
      return res.status(200).send('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
  
   const PORT = 5000;

   app.listen(PORT, ()=>{
    console.log("server is runnning on port" + PORT)
   })
const express = require("express");
const multer = require('multer');
const admin = require("firebase-admin");
const { v4: uuidv4 } = require('uuid');

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

app.get("/", async (req, res) => {
  try {
    let response = [];

    const querySnapshot = await filesCollection.get();
    querySnapshot.forEach((doc) => {
      response.push(doc.data());
    });

    return res.status(200).send(response);
  } catch (error) {
    return res.status(500).send(error);
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
      const uniqueFilename = `${uuidv4()}_${filename}`;
  
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

//   app.post('/add', upload.single('file'), async (req, res) => {
//     try {
//       const { filename, user } = req.body;
//       const file = req.file;
  
//       console.log(file,filename, user, req.body);
//       console.log(file)
//       // Check if a file with the same filename already exists
//       const querySnapshot = await filesCollection.where('filename', '==', filename).get();
  
//       if (!querySnapshot.empty) {
//         return res.status(400).send('File with the same filename already exists');
//       }
  
//       // Generate a unique filename using UUID
//       const uniqueFilename = `${uuidv4()}_${filename}`;
  
//       // Create a new file reference in Firebase Storage
//       const fileRef = storage.ref().child(uniqueFilename);
  
//       // Upload the file to Firebase Storage
//       await fileRef.put(file.buffer);
  
//       // Get the download URL of the uploaded file
//       const downloadURL = await fileRef.getDownloadURL();
  
//       // Create a new document with the file details in Firestore
//       const newFile = await filesCollection.add({
//         filename,
//         user,
//         downloadURL,
//       });
  
//       return res.status(200).send(`File added successfully with ID: ${newFile.id}`);
//     } catch (error) {
//       console.error('Error adding file:', error);
//       return res.status(500).send('Internal Server Error');
//     }
//   });
  
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
const express = require("express");
 
var admin = require("firebase-admin");

var serviceAccount = require("./config.json");
// const { v4: uuidv4 } = require('uuid');
// const { storage, getStorage, ref, uploadBytes } = require('firebase/storage');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express()

const db = admin.firestore();
const filesCollection = db.collection("files");
 
 app.use(express.json())
 app.use(express.urlencoded({extended: true}))

   app.get("/", async (req, res) => {
    try {
      let response = [];
  
      await filesCollection.get().then((querySnapshot) => {
        let docs = querySnapshot.docs;
  
        for (let doc of docs) {
          response.push(doc);
        }
      });
  
      return res.status(200).send(response);
    } catch (error) {
      return res.status(500).send(error);
    }
  });

  app.post('/add', async (req, res) => {
    try {
      const { filename, user, contents } = req.body;
      console.log(filename, user, contents);
  
      // Check if a file with the same filename already exists
      const querySnapshot = await filesCollection
        .where('filename', '==', filename)
        .get();
  
      if (!querySnapshot.empty) {
        return res.status(400).send('File with the same filename already exists');
      }
  
      // Create a new document with an auto-generated ID
      const newFile = await filesCollection.add({
        filename,
        user,
        contents,
      });
  
      return res.status(200).send(`File added successfully with ID: ${newFile.id}`);
    } catch (error) {
      console.error('Error adding file:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
  
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
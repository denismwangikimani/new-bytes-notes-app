// external imports
const mongoose = require("mongoose");
require("dotenv").config();

async function dbConnect() {
  // use mongoose to connect this app to our database on mongoDB using the DB_URL (connection string)
  mongoose
    .connect(process.env.DB_URL)
    .then(() => {
      console.log("Successfully connected to MongoDB Atlas!");
    })
    // if there is an error connecting to the database, log the error to the console
    .catch((error) => {
      console.log("Unable to connect to MongoDB Atlas!");
      console.error(error);
    });
}

// export the dbConnect function
module.exports = dbConnect;

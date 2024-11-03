// external imports
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function dbConnect() {
  // use mongoose to connect this app to our database on mongoDB using the DB_URL (connection string)
  mongoose
    .connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Successfully connected to MongoDB Atlas!");
    })
    // if there is an error connecting to the database, log the error to the console
    .catch((error) => {
      console.log("Unable to connect to MongoDB Atlas!");
      console.error(error);
      throw error;
    });
}

// export the dbConnect function
module.exports = dbConnect;

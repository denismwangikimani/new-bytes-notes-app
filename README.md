# Byte-Notes

## Project Overview

### Description
Byte-Notes is a web-based note-taking application that allows users to create, edit, and manage their notes. The application is built using the MERN stack (MongoDB, Express, React, Node.js) and provides a seamless user experience for managing notes across different devices.

### Project Structure
The project is divided into two main parts: the client (frontend) and the server (backend).

#### Client (Frontend)
The client side is built using React and is located in the `client` directory. It includes the following key components and files:

- **`client/src/App.js`**: The main application component that sets up the routes using React Router.
- **`client/src/components`**: Contains various React components used in the application, such as `Login`, `SignUp`, `Notes`, `LandingPage`, and CRUD components for managing notes.
- **`client/src/components/CRUD`**: Contains components related to creating, reading, updating, and deleting notes, such as `CreateNoteButton`, `EditorHeader`, `NoteActions`, `NoteEditor`, `NoteItem`, `NoteList`, `SidebarContext`, and `SidebarToggle`.
- **`client/src/index.js`**: The entry point of the React application.
- **`client/public`**: Contains static files like `index.html`, `manifest.json`, and `robots.txt`.

#### Server (Backend)
The server side is built using Node.js and Express and is located in the `server` directory. It includes the following key files:

- **`server/app.js`**: The main Express application file that sets up routes and middleware.
- **`server/auth.js`**: Middleware for handling JWT authentication.
- **`server/db`**: Contains database-related files, including `dbConnect.js` for connecting to MongoDB, `noteModel.js` for the Note schema, and `userModel.js` for the User schema.
- **`server/index.js`**: The entry point of the Node.js server.
- **`server/.env`**: Environment variables for the server.

### Key Features
1. **User Authentication**:
   - Users can register and log in to the application.
   - JWT is used for authentication and authorization.

2. **Note Management**:
   - Users can create, edit, and delete notes.
   - Notes are automatically saved and updated in the database.
   - Notes can be searched and filtered based on creation date.

3. **Responsive Design**:
   - The application is designed to be responsive and works well on both desktop and mobile devices.

4. **Protected Routes**:
   - Certain routes, such as the notes page, are protected and require authentication to access.

### How to Run the Project
1. **Clone the Repository**:
   ```sh
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install Dependencies**:
   For the client:
   ```sh
   cd client
   npm install
   ```

   For the server:
   ```sh
   cd server
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the `server` directory with the following content:
   ```sh
   DB_URL=<your-mongodb-connection-string>
   PORT=3000
   ```

4. **Run the Server**:
   ```sh
   cd server
   npm start
   ```

5. **Run the Client**:
   ```sh
   cd client
   npm start
   ```

6. **Access the Application**:
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

### Additional Information
**Dependencies**:

- **Client**: React, React Router, Axios, Lucide-React, etc.
- **Server**: Express, Mongoose, Bcryptjs, Jsonwebtoken, etc.

**Scripts**:

- **Client**:
  - `npm start`: Starts the development server.
  - `npm run build`: Builds the application for production.
  - `npm test`: Runs the test suite.

- **Server**:
  - `npm start`: Starts the server.
  - `npm run dev`: Starts the server with Nodemon for development.

This overview provides a high-level explanation of the Byte-Notes project, including its structure, key features, and how to run it.
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB-txU7AJYb79ZUIEd6juJvIUx7ig-AAQg",
  authDomain: "flightbooking-5cadf.firebaseapp.com",
  projectId: "flightbooking-5cadf",
  storageBucket: "flightbooking-5cadf.appspot.com",
  messagingSenderId: "687615781281",
  appId: "1:687615781281:web:fcb7c70fa353a72a33c3e0",
  measurementId: "G-3FVGT5GG20",
};

initializeApp(firebaseConfig);

import express from "express";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const auth = getAuth();
const db = getFirestore();

var jsonParser = bodyParser.json();

// Login User

app.get("/", (req, res) => {
  res.send("Working API");
});

app.post("/login", jsonParser, (req, res) => {
  // Login using Firebase Function
  signInWithEmailAndPassword(auth, req.body.email, req.body.password)
    .then(async (UserCredential) => {
      const user = UserCredential.user;
      // Create JWT token with EXP time
      let token = jwt.sign(req.body, process.env.SECRET_KEY, {
        expiresIn: "12h",
      });

      const userRef = collection(db, "users");
      const q = query(userRef, where("email", "==", req.body.email));

      let username;
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((result) => {
        username = result.data();
        console.log(result.data());
      });

      res.send({ token: token, email: req.body.email, name: username });
    })
    .catch((error) => {
      const errorMessage = error.message;
      console.log(errorMessage);
      res.send(errorMessage);
    });
});

app.post("/signup", jsonParser, (req, res) => {
  createUserWithEmailAndPassword(auth, req.body.email, req.body.password)
    .then((UserCredential) => {
      const user = UserCredential.user;
      let token = jwt.sign(req.body, process.env.SECRET_KEY, {
        expiresIn: "12h",
      });

      const userRef = collection(db, "users");
      addDoc(userRef, {
        email: req.body.email,
        name: req.body.name,
      }).then(() => {
        res.send({ token: token, email: req.body.email, name: req.body.name });
      });
    })

    .catch((error) => {
      const errorMessage = error.message;
      console.log(errorMessage);
      res.send(errorMessage);
    });
});

app.get("/signout", (req, res) => {
  signOut(auth)
    .then(() => {
      res.send(200);
    })
    .catch((error) => {
      res.send(error);
    });
});

// Add Flight - Only by Admin
// Send the flight information to add flight
// {
//     "flight-number":"000",
//     "flight-name":"Emirates",
//     "from":"United States",
//     "to":"London",
//     "date":"16/11/2022",
//     "price":81341,
//     "seat-available":60
// }

app.post("/addflight", verifyToken, jsonParser, (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, async (err, authData) => {
    if (err) {
      // Forbidden to Enter Site
      res.send(403);
    } else if (authData.email == "admin@admin.com") {
      // Add the Flight Data to Firestore
      console.log(req.body);

      const flightRef = collection(db, "flights");
      addDoc(flightRef, req.body).then((response) => {
        res.send(response);
      });
    } else {
      res.send(403);
    }
  });
});

// Delete Flight - Only by Admin
// Send Flight ID to delete the flight

app.post("/deleteflight", verifyToken, jsonParser, (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, async (err, authData) => {
    if (err) {
      // Forbidden to Enter Site
      res.send(403);
    } else if (authData.email == "admin@admin.com") {
      // Add the Flight Data to Firestore
      console.log("I am Admin : ", req.body);

      // query is made to fetch document with the corresponding ID
      const flightRef = collection(db, "flights");
      const q = query(flightRef, where("flight-number", "==", req.body.id));
      const querySnapshot = await getDocs(q);

      // query iterated and deleted
      querySnapshot.forEach((result) => {
        // Doc is deleted here
        deleteDoc(doc(db, "flights", result.id));
        res.send(200);
      });
    } else {
      res.send(403);
    }
  });
});

// Search Flight
// Input - Date, From, To
// {
//     "from":"United States",
//     "to":"London",
//     "date":"16/11/2022"
// }
app.get("/search", verifyToken, jsonParser, async (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, async (err, authData) => {
    if (err) {
      // Forbidden to Enter Site
      res.send(403);
    } else {
      // Search for flight
      const flightRef = collection(db, "flights");

      const q1 = query(
        flightRef,
        where("from", "==", req.body.from),
        where("to", "==", req.body.to),
        where("date", "==", req.body.date)
      );

      let allFlights = {};
      const querySnapshot = await getDocs(q1);
      querySnapshot.forEach((result) => {
        allFlights[result.id] = result.data();
        console.log(result.data());
      });
      res.send(allFlights);
    }
  });
});

// Book Flight
// User Mail Address
app.post("/bookflight", verifyToken, jsonParser, async (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, async (err, authData) => {
    if (err) {
      // Forbidden to Enter Site
      res.send(403);
    } else {
      // Book Flight
      // Add the flight details to my bookings
      const userRef = collection(db, "users");
      const q = query(userRef, where("email", "==", req.body.email));

      let user_doc_id;
      const querySnapshotUsers = await getDocs(q);
      querySnapshotUsers.forEach((result) => {
        user_doc_id = result.id;
      });

      const updateUserRef = doc(db, "users", user_doc_id);
      await updateDoc(updateUserRef, {
        "my-bookings": arrayUnion({
          "flight-number": req.body["flight-number"],
          tickets: req.body.tickets,
          time: new Date(),
        }),
      });

      //   Reduce the number of seats in the actual flight
      const flightRef = collection(db, "flights");

      const flightQuery = query(
        flightRef,
        where("flight-number", "==", req.body["flight-number"])
      );
      const querySnapshotFlights = await getDocs(flightQuery);

      querySnapshotFlights.forEach(async (result) => {
        // Doc is deleted here
        let flightInfo = result.data();
        const singleRef = doc(db, "flights", result.id);
        let updatedSeat = flightInfo["seat-available"] - req.body.tickets;

        await updateDoc(singleRef, {
          "seat-available": updatedSeat,
        });
      });
      res.sendStatus(200);
    }
  });
});

// Verify if there is a token received to view website
function verifyToken(req, res, next) {
  const bearerHeader = req.headers["authorization"];

  if (bearerHeader) {
    // Get the token from the Header
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];
    req.token = bearerToken;
    next();
  } else {
    // Forbidden to Enter Site
    res.send(403);
  }
}

app.listen(8000, () => {
  console.log("working");
});

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// * middlewares start
app.use(cors());
app.use(express.json());
// * middlewares end

// * connect mongoDB start
const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.2ahck7i.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// * connect mongoDB end

// * collections start
const roomsCollection = client.db("testDBUser").collection("rooms");
const partnerCollection = client.db("testDBUser").collection("partners");
const partnersHostingsCollection = client
  .db("testDBUser")
  .collection("partnersHostings");
const paymentsCollection = client.db("testDBUser").collection("payments");
const aboutCollection = client.db("testDBUser").collection("about");
const servicesCollection = client.db("testDBUser").collection("services");
const emailsCollection = client.db("testDBUser").collection("emails");
// * collections end

// * CRUD run function start
const run = async () => {
  try {
    // * post Partner Hosting API start
    app.post("/host-partner", async (req, res) => {
      const partnersHostingData = req.body;
      const result = await partnersHostingsCollection.insertOne(
        partnersHostingData
      );
      res.send(result);
    });
    // * post Partner Hosting API end

    // * post Send Email Verification API start
    app.post("/email-verify", async (req, res) => {
      const email = req.body;
      const verificationCode = Math.floor(Math.random() * 9000) + 1000;
      const data = {
        email,
        verificationCode,
        isVerified: false,
      };
      const result = await emailsCollection.insertOne(data);
      res.send({
        result,
        message: "Your verification code is : " + verificationCode,
      });
    });
    // * post Send Email Verification API end

    // * post check Email Verification API start
    app.post("/check-verification-code", async (req, res) => {
      const verficationData = req.body;
      const { email, verificationCode } = verficationData;
      const user = await emailsCollection.findOne({
        "email.email": email,
      });

      const isVerified = user.verificationCode === parseInt(verificationCode);
      if (isVerified) {
        const updatedData = {
          $set: {
            isVerified: true,
          },
        };
        const updated = await emailsCollection.updateOne(
          { "email.email": email },
          updatedData
        );
        if (updated.modifiedCount > 0) {
          res.send({ message: "Email Verified Successfully" });
        }
      } else {
        res.status(401).send({ message: "Invalid Verification Code" });
      }
    });
    // * post check Email Verification API end

    // * post add new partners API start
    app.post("/new-partner", async (req, res) => {
      const partnerData = req.body;
      if (!partnerData) {
        return res.status(401).send({
          message: "Please pass a partner data in your post API's body",
        });
      }
      const result = await partnerCollection.insertOne(partnerData);
      res.send(result);
    });
    // * post add new partners API end

    // * post make a new payment API start
    app.post("/create-payment-intent", async (req, res) => {
      const paymentData = req.body;
      const { amount } = paymentData;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      const clientSecret = paymentIntent.client_secret;
      const result = await paymentsCollection.insertOne({
        ...paymentData,
        clientSecret,
      });
      res.send({ result, clientSecret: clientSecret });
    });
    // * post make a new payment API end

    // * confirm payment API start
    app.get("/confirm-payment", async (req, res) => {
      const { email, clientSecret } = req.query;
      const result = await paymentsCollection.findOne({
        email: email,
        clientSecret: clientSecret,
      });
      if (result) {
        res.send({ message: "Payment Successfully Done!" });
      } else {
        res.send({ message: "Payment Failed, Invalid Data !" });
      }
    });
    // * confirm payment API end

    // ! get Searching and Filtering API start
    /* app.get("/get-searching-item", async (req, res) => {
      const { search } = req.query;
      const query = { $text: { $search: search } };
      await roomsCollection.createIndex({ name: "text" });
      const searchResult = await roomsCollection.find(query).toArray();
      res.status(200).send(searchResult);
    }); */
    // ! get Searching and Filtering API end
    // * get About API start
    app.get("/get-about", async (req, res) => {
      const query = {};
      const result = await aboutCollection.find(query).toArray();
      res.send(result);
    });
    // * get About API end
    // * get hosted partner API start
    app.get("/get-hosted-partner", async (req, res) => {
      const query = {};
      const result = await partnersHostingsCollection.find(query).toArray();
      res.send(result);
    });
    // * get hosted partner API end
    // * get filter data API start
    app.get("/get-filters", async (req, res) => {
      const { wifi, washer, dryer } = req.query;

      const params = {};

      if (wifi === "true") {
        params["features.wifi"] = true;
      }
      if (washer === "true") {
        params["features.washer"] = true;
      }
      if (dryer === "true") {
        params["features.dryer"] = true;
      }

      if (Object.keys(params).length === 0) {
        const allRooms = await roomsCollection.find().toArray();
        res.send(allRooms);
      } else {
        const filter = await roomsCollection.find(params).toArray();
        res.send(filter);
      }
    });
    // * get filter data API end

    // * get about our service API start
    app.get("/services", async (req, res) => {
      const query = {};
      const result = await servicesCollection.find(query).toArray();
      res.send(result);
    });
    // * get about our service API end

    // * delete Partner Hosting API start
    app.delete("/delete-partner-hosting/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await partnersHostingsCollection.deleteOne(query);
      res.send(result);
    });
    // * delete Partner Hosting API end

    // * update Partner Hosting API start
    app.put("/update-partner-hosting/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          partnerFinded: true,
        },
      };
      const result = await partnersHostingsCollection.updateOne(
        filter,
        updatedData,
        { upsert: true }
      );
      res.send(result);
    });
    // * update Partner Hosting API end

    // * update Image Upload API start
    app.patch("/update-image-upload/:id", async (req, res) => {
      const id = req.params.id;
      const updatedImageURL = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          imgURL: updatedImageURL,
        },
      };
      const result = await partnersHostingsCollection.updateOne(
        filter,
        updatedData
      );
      res.send(result);
    });
    // * update Image Upload API end
  } finally {
    console.log();
  }
};

run().catch((err) => console.log(err));
// * CRUD run function end

// * initial configurations for express start
app.get("/", (req, res) => {
  res.send("Server is Running Hurrah!");
});
app.listen(port, () => {
  console.log(`Server in Port ${port}`);
});

// * initial configurations for express end

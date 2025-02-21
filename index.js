const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://autofusion-30918.web.app"],
  })
);
app.use(express.json());

const client = new MongoClient(process.env.URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("AutoFusion").collection("users");
    const sellersCarCollection = client
      .db("AutoFusion")
      .collection("sellersCars");
    const savedAdsCollection = client.db("AutoFusion").collection("savedAds");
    const feedbackCollection = client.db("AutoFusion").collection("feedbacks");
    const allBidsCollection = client.db("AutoFusion").collection("allBids");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    const isToken = (req, res, next) => {
      const tokenAuthorization = req.headers.authorization;
      if (!tokenAuthorization) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const token = tokenAuthorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const isAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.userType === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access!" });
      }
      next();
    };

    app.post("/newUserApi", async (req, res) => {
      try {
        const newUserInfo = req.body;
        const query = { email: newUserInfo?.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        } else {
          const result = await userCollection.insertOne(newUserInfo);
          res.send(result);
        }
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    app.post("/newCarSellByUser", isToken, async (req, res) => {
      try {
        const result = await sellersCarCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // post new saved ad to database
    app.post("/newSavedAd", async (req, res) => {
      try {
        const result = await savedAdsCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // post feedback by user
    app.post("/userFeedback", async (req, res) => {
      try {
        const result = await feedbackCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // post new bid details
    app.post("/newBid", isToken, async (req, res) => {
      try {
        const bidDetails = req.body;
        const productId = bidDetails.productId;
        const filter = { _id: new ObjectId(productId) };
        const currentProduct = await productListingsBySellers.findOne(filter);
        const currentBidAmount = currentProduct?.totalBids || 0;
        const totalBids = currentBidAmount + 1;
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            totalBids: totalBids,
          },
        };
        const updateTotalBid = await productListingsBySellers.updateOne(
          filter,
          updateDoc,
          options
        );
        if ((updateTotalBid.modifiedCount = 0)) {
          return res.send(false);
        }
        const result = await allBidsCollection.insertOne(bidDetails);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get a single feedback
    app.get("/singleFeedback/:id", async (req, res) => {
      try {
        const query = { feedbackBy: req.params.id };
        const result = await feedbackCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get all the feedback
    app.get("/allFeedbacks", async (req, res) => {
      try {
        const result = await feedbackCollection
          .find()
          .sort({ _id: -1 })
          .limit(5)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // verify admin middleware
    app.get("/user/admin/:email", isToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (user.userType === "admin") {
          // admin = true;
          res.send({ admin: true });
        } else {
          res.send({ admin: false });
        }
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get single saved ad
    app.get("/getSingleSavedAd/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.query;
        const query = { singleAdId: id, userEmail: email.email };
        const result = await savedAdsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get all the users
    app.get("/allUsers", isToken, isAdmin, async (req, res) => {
      try {
        const userType = "user";
        const query = { userType: userType };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get the current user
    app.get("/currentUser", async (req, res) => {
      try {
        const query = { email: req.query.email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get all the listings
    app.get("/allListings", async (req, res) => {
      try {
        const result = await sellersCarCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get filtered and paginated result
    app.get("/filteredListings", async (req, res) => {
      try {
        // console.log(req.query);
        // get the query result coming from front end
        const listingPerPage = parseInt(req.query.listingPerPage);
        const currentPage = parseInt(req.query.currentPage);
        const carCondition = req.query.carCondition;
        const carBrand = req.query.carBrand;
        const carPrice = req.query.carPrice;
        const maxPrice = parseInt(carPrice.split("-")[1]);
        const minPrice = parseInt(carPrice.split("-")[0]);

        // validate result using query result
        const query = {};
        if (carCondition !== "all") {
          query.carCondition = { $regex: carCondition, $options: "i" };
        }
        if (carBrand !== "all") {
          query.carBrand = { $regex: carBrand, $options: "i" };
        }
        if (carPrice !== "all" && minPrice === 8000) {
          query.price = { $gte: minPrice };
        }
        if (carPrice !== "all" && minPrice !== 8000) {
          query.price = { $lte: maxPrice, $gte: minPrice };
        }

        // get the queried result
        const filteredResult = await sellersCarCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        // pagination for the queried result
        const totalPages = Math.ceil(filteredResult.length / listingPerPage);
        const startIndex = (currentPage - 1) * listingPerPage;
        const endIndex = currentPage * listingPerPage;
        const filteredListings = filteredResult.slice(startIndex, endIndex);

        // send the result to frontend
        res.send({ totalPages, filteredListings });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get bids for a single product
    app.get("/allBidsForProduct/:id", async (req, res) => {
      try {
        const query = { productId: req.params.id };
        const result = await allBidsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get sliced listings for homepage
    app.get("/homeListings", async (req, res) => {
      try {
        const result = await sellersCarCollection
          .find()
          .sort({ _id: -1 })
          .limit(8)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching homeListings:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get top bid listings for homepage
    app.get("/topBidHomeListings", async (req, res) => {
      try {
        const result = await sellersCarCollection
          .find()
          .sort({ totalBids: -1 })
          .limit(8)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching top listings:", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get saved items by the users
    app.get("/savedAdsList/:email", async (req, res) => {
      try {
        const query = { userEmail: req.params.email };
        const result = await savedAdsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // get specific seller listings
    app.get("/listings/:email", isToken, async (req, res) => {
      try {
        const query = { sellerEmail: req.params.email };
        const result = await sellersCarCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // Get a single listing
    app.get("/singleListing/:id", async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) };
        const result = await sellersCarCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // update verification request for a user
    app.put("/updateUserDetails/:id", isToken, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const options = { upsert: true };
        const updateDoc = { $set: {} };

        // update request status
        if (req.body.requestUpdate) {
          updateDoc.$set.verificationRequest = req.body.requestUpdate;
        }
        // update verification status
        if (req.body.updatedVerifyStatus) {
          updateDoc.$set.verifyStatus = req.body.updatedVerifyStatus;
        }
        // update phone
        if (req.body.phone) {
          updateDoc.$set.phone = req.body.phone;
        }
        // update address
        if (req.body.address) {
          updateDoc.$set.address = req.body.address;
        }
        const result = await userCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // update seller verification status in the product list
    app.put(
      "/updateSellerVerification/:id",
      isToken,
      isAdmin,
      async (req, res) => {
        try {
          const filter = { sellerId: req.params.id };
          const updateStatus = {
            $set: {
              sellerVerificationStatus: req.body.updatedVerifyStatus,
            },
          };
          const result = await sellersCarCollection.updateMany(
            filter,
            updateStatus
          );
          res.send(result);
        } catch (error) {
          console.error("Error", error);
          res.status(500).send({ message: "Internal Server Error." });
        }
      }
    );

    app.put("/updateListing/:id", isToken, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            carName: req.body.carName,
            carBrand: req.body.carBrand,
            carType: req.body.carType,
            price: req.body.price,
            carCondition: req.body.carCondition,
            purchasingDate: req.body.purchasingDate,
            description: req.body.description,
            photo: req.body.photo,
            approvalStatus: req.body.approvalStatus,
            addingDate: req.body.addingDate,
            manufactureYear: req.body.manufactureYear,
            engineCapacity: req.body.engineCapacity,
            totalRun: req.body.totalRun,
            fuelType: req.body.fuelType,
            transmissionType: req.body.transmissionType,
            registeredYear: req.body.registeredYear,
            sellerPhone: req.body.sellerPhone,
          },
        };
        const result = await sellersCarCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // update a sell status of a listing
    app.put("/updateSellStatus/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            sellStatus: req.body.sellStatus,
          },
        };
        const result = await sellersCarCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // delete a single saved ad
    app.delete("/removedSavedAd/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const email = req.query;
        const query = { singleAdId: id, userEmail: email.email };
        const result = await savedAdsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    // Delete a product from collections of seller post
    app.delete("/api/deleteSingleListing/:id", isToken, async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) };
        const result = await sellersCarCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error", error);
        res.status(500).send({ message: "Internal Server Error." });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server running smoothly");
});

app.listen(port, () => {
  console.log(`Auto Fusion is running on http://localhost:${port}`);
});

import express from "express";
import dotenv from "dotenv";
import { Reclaim, generateUuid } from "@reclaimprotocol/reclaim-sdk";
import cors from "cors";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";

dotenv.config();

var app = express();
const callbackUrl = process.env.CALLBACK_URL + "/callback/";
const client = new MongoClient(process.env.MONGO_URL);

app.use(express.json());
app.use(cors());

const reclaim = new Reclaim(callbackUrl);

const isValidRepo = (repoStr) => {
  return repoStr.indexOf("/") > -1 && repoStr.split("/").length === 2;
};

app.post("/repo", async (req, res) => {
  const { repo, email } = req.body;
  if (!repo || !email) {
    res.status(400).send(`400 - Bad Request: repo and email are required`);
    return;
  }
  console.log(repo, email);
  const repoFullName = repo;
  const emailStr = email;

  if (!isValidRepo(repoFullName)) {
    res.status(400).send(`400 - Bad Request: invalid repository name`);
    return;
  }

  const callbackId = "repo-" + generateUuid();
  const template = (
    await reclaim.connect("Github-contributor", [
      {
        provider: "github-contributor",
        params: {
          repo: repoFullName,
        },
      },
    ])
  ).generateTemplate(callbackId);
  const url = template.url;
  const templateId = template.id;
  // mongoose
  //   .connect(process.env.MONGO_URL, {
  //     useNewUrlParser: true,
  //     useUnifiedTopology: true,
  //   })
  //   .then(() => {
  //     console.log("Connected to MongoDB");
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //   });
  try {
    const database = client.db("Reclaim");
    const usersDB = database.collection("users");
    // create a document to insert
    const doc = {
      callback_id: callbackId,
      status: "pending",
      repo: repoFullName,
      email: emailStr,
      template_id: templateId,
    };
    const result = await usersDB.insertOne(doc);
    console.log(`A document was inserted with the _id: ${result.insertedId}`);
  } catch (e) {
    console.log(e);
  } finally {
    await client.close();
  }

  res.json({ url, callbackId });
});

// app.get("/status/:callbackId", async (req, res) => {
//   let statuses;

//   if (!req.params.callbackId) {
//     res.status(400).send(`400 - Bad Request: callbackId is required`);
//     return;
//   }

//   const callbackId = req.params.callbackId;

//   try {
//     const results = await pool.query(
//       "SELECT callback_id FROM submitted_links WHERE callback_id = $1",
//       [callbackId]
//     );
//     if (results.rows.length === 0) {
//       res.status(404).send(`404 - Not Found: callbackId not found`);
//       return;
//     }
//   } catch (e) {
//     res.status(500).send(`500 - Internal Server Error - ${e}`);
//     return;
//   }

//   try {
//     statuses = await pool.query(
//       "SELECT status FROM submitted_links WHERE callback_id = $1",
//       [callbackId]
//     );
//   } catch (e) {
//     res.status(500).send(`500 - Internal Server Error - ${e}`);
//     return;
//   }

//   res.json({ status: statuses?.rows[0]?.status });
// });

app.use(express.text({ type: "*/*" }));

app.post("/callback/:id", async (req, res) => {
  if (!req.params.id) {
    res.status(400).send(`400 - Bad Request: callbackId is required`);
    return;
  }

  if (!req.body) {
    res.status(400).send(`400 - Bad Request: body is required`);
    return;
  }

  console.log(req.body);

  const reqBody = JSON.parse(decodeURIComponent(req.body));

  if (!reqBody.claims || !reqBody.claims.length) {
    res.status(400).send(`400 - Bad Request: claims are required`);
    return;
  }

  const callbackId = req.params.id;

  const claims = { claims: reqBody.claims };

  try {
    const database = client.db("Reclaim");
    const userDB = database.collection("users");
    // create a filter for a movie to update
    const filter = { callback_id: callbackId };
    // this option instructs the method to create a document if no documents match the filter
    // create a document that sets the plot of the movie
    const updateDoc = {
      $set: {
        claims: JSON.stringify(claims),
        status: "verified",
        callbackId: callbackId,
      },
    };
    const result = await userDB.updateOne(filter, updateDoc);
    console.log(
      `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`
    );
  } catch (e) {
    console.log(e);
  } finally {
    await client.close();
  }

  // try {
  //   await pool.query(
  //     "UPDATE submitted_links SET claims = $1, status = $2 WHERE callback_id = $3;",
  //     [JSON.stringify(claims), "verified", callbackId]
  //   );
  // } catch (e) {
  //   res.status(500).send(`500 - Internal Server Error - ${e}`);
  //   return;
  // }

  res.send(`<div
	style="
	  width: 100%;
	  height: 100%;
	  display: flex;
	  text-align: center;
	  justify-content: center;
	  align-items: center;
	"
  >
	<h1>
	  Submitted claim successfully! 
	</h1>
  </div>`);
});

process.on("uncaughtException", function (err) {
  console.log("Caught exception: ", err);
});

app.get("/", function (req, res) {
  res.send("Hello World");
});

var server = app.listen(3001, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Example app listening at localhost", host, port);
});

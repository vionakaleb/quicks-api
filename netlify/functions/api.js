const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createClient } = require("@supabase/supabase-js");
const serverless = require("serverless-http");

const dayjs = require("dayjs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Supabase Config
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Gemini Config
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// API Routes
const tasksRouter = require("../../app/routes/tasks")(supabase, dayjs);
const chatsRouter = require("../../app/routes/chats")(supabase, model, dayjs);

const router = express.Router();
router.use("/tasks", tasksRouter);
router.use("/chats", chatsRouter);
app.use("/.netlify/functions/api", router);

// app.use("/tasks", tasksRouter);
// app.use("/chats", chatsRouter);

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err, origin) => {
  console.error("Uncaught Exception:", err, "Origin:", origin);
});

module.exports.handler = serverless(app);

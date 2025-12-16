# ⚡️ Quicks API

The backend REST API service for the Quicks application, integrated with GoogleGenerativeAI Gemini for chatbot.
Built with Express.js, backed by Supabase (PostgreSQL), and deployed as a serverless function on Netlify.

## 🔗 URL

Live Demo: Deployed on Netlify
[https://quicks-app-vk.netlify.app/](https://quicks-app-vk.netlify.app/)

FE repo:
[https://github.com/vionakaleb/quicks-app.git](https://github.com/vionakaleb/quicks-api.git)

## ✨ Features

💬 Real-time Chat: Seamless messaging interface for individual and group conversations.

🤖 AI Assistant: Integrated chatbot powered by Google Gemini for answering queries and assisting with tasks.

✅ Task Management: Comprehensive management features allowing users to seamlessly create, modify, and remove conversations and tasks.

## 🛠 Tech Stack

Runtime: Node.js

Framework: Express.js

Database: Supabase (PostgreSQL)

Deployment: Netlify Functions

Data Format: JSON

## 🗄️ Database Schema

The application uses Supabase (PostgreSQL).

create table public.conversations (
id text not null,
title text null,
participants integer null,
"lastMessage" text null,
"lastMessageDate" text null,
"isUnread" boolean null,
type text null,
messages jsonb null default '[]'::jsonb,
"participantCount" smallint null default '0'::smallint,
constraint conversations_pkey primary key (id)
) TABLESPACE pg_default;

create table public.conversations (
id text not null,
title text null,
participants integer null,
"lastMessage" text null,
"lastMessageDate" text null,
"isUnread" boolean null,
type text null,
messages jsonb null default '[]'::jsonb,
"participantCount" smallint null default '0'::smallint,
constraint conversations_pkey primary key (id)
) TABLESPACE pg_default;

## 🚀 Getting Started

To run this project locally, ensure you have Node.js and the Netlify CLI installed.

### 1. Clone the repository

`git clone [https://github.com/vionakaleb/quicks-api.git](https://github.com/vionakaleb/quicks-api.git)`

`cd quicks-api`

### 2. Install dependencies

`npm install`

### 3. Configure Environment

Create a .env file in the root directory and add your Supabase credentials:

`SUPABASE_URL=your_supabase_url`
`SUPABASE_KEY=your_supabase_anon_key`
`GEMINI_API_KEY=your_gemini_api_key`

API requests is prefixed with the following base URL:
[https://quicks-api-vk.netlify.app/.netlify/functions/api](https://quicks-api-vk.netlify.app/.netlify/functions/api)

### 4. Run locally (Netlify Dev)

This emulates the Netlify Functions environment locally.

`netlify dev`

### 5. Deploy to Netlify

`netlify deploy --prod`

The API will likely be available at http://localhost:8888/.netlify/functions/api

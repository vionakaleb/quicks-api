⚡️ Quicks API

The backend REST API service for the Quicks application, integrated with GoogleGenerativeAI Gemini for chatbot.
Built with Express.js, backed by Supabase (PostgreSQL), and deployed as a serverless function on Netlify.

🔗 Base URL

All API requests should be prefixed with the following base URL:

[https://quicks-api-vk.netlify.app/.netlify/functions/api](https://quicks-api-vk.netlify.app/.netlify/functions/api)

🛠 Tech Stack

````Runtime: Node.js

Framework: Express.js

Database: Supabase (PostgreSQL)

Deployment: Netlify Functions

Data Format: JSON```


🗄️ Database Schema

The application uses Supabase.

```create table public.conversations (
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
) TABLESPACE pg_default;```


🚀 Local Development

To run this project locally, ensure you have Node.js and the Netlify CLI installed.

Clone the repository

```git clone [https://github.com/vionakaleb/quicks-api.git](https://github.com/vionakaleb/quicks-api.git)
cd quicks-api```


Install dependencies

```npm install```


Configure Environment Variables
Create a .env file in the root directory and add your Supabase credentials:

```SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key```

Run locally (Netlify Dev)
This emulates the Netlify Functions environment locally.

netlify dev

The API will likely be available at http://localhost:8888/.netlify/functions/api


📄 License

This project is open source and available under the MIT License.
````

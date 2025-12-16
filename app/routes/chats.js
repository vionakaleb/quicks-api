const express = require("express");
const router = express.Router();

module.exports = (supabase, model, dayjs) => {
  const getAllConversations = () => {
    return supabase.from("conversations").select("*").order("id");
  };

  const searchConversations = (query) => {
    return supabase
      .from("conversations")
      .select("*")
      .or(`title.ilike.%${query}%,lastMessage.ilike.${query}`)
      .order("id");
  };

  const getParticipants = (messages) => {
    const participants = [...new Set(messages.map((msg) => msg.sender))];

    const formatName = participants.map((participant) => {
      if (participant === "ai-agent") return "AI Agent";
      if (participant === "me") return "Me";

      return participant
        .replace(/-/g, " ") // Replace hyphens with spaces
        .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter
    });

    return {
      participants,
      participantList: formatName.join(", "),
      count: participants.length,
    };
  };

  // GET ALL CHATS
  router.get("/", async (req, res) => {
    const { data, error } = await getAllConversations();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // SEARCH CHATS
  router.get("/search", async (req, res) => {
    const { query } = req.query;
    console.log(query, "query");

    const promise = query ? searchConversations(query) : getAllConversations();
    const { data, error } = await promise;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // CREATE CHAT
  router.post("/", async (req, res) => {
    const baseTitle = "New Conversation";

    // Find unique title from existing chats
    const { data: existingConversations, error: fetchError } = await supabase
      .from("conversations")
      .select("title")
      .like("title", `${baseTitle}%`);

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    let highestCounter = 0;
    if (existingConversations) {
      existingConversations.forEach((convo) => {
        if (convo.title === baseTitle) {
          highestCounter = Math.max(highestCounter, 1);
        } else {
          const match = convo.title.match(/^New Conversation (\d+)$/);
          if (match) {
            highestCounter = Math.max(highestCounter, parseInt(match[1], 10));
          }
        }
      });
    }

    // Generate unique title
    const newCounter = highestCounter + 1;
    const finalTitle =
      newCounter === 1 ? baseTitle : `${baseTitle} ${newCounter}`;

    const { data, error } = await supabase
      .from("conversations")
      .insert([
        {
          id: dayjs().unix().toString(),
          title: finalTitle,
          messages: [],
          isUnread: true,
          lastMessage: "Type -> AI: To start chatting with AI",
          lastMessageDate: dayjs().format("YYYY-MM-DD HH:mm"),
        },
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  });

  // DELETE CHAT BY ID
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0)
      return res.status(404).send("Conversation not found");

    res.status(204).send();
  });

  // DELETE ALL MESSAGES IN CHAT
  router.delete("/:id/messages", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .update({
        messages: [],
        lastMessage: "Open to start conversation",
        lastMessageDate: dayjs().format("YYYY-MM-DD HH:mm"),
      })
      .eq("id", id)
      .select("id");

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0)
      return res.status(404).send("Conversation not found");

    res.status(204).send();
  });

  // MARK CHAT AS READ
  router.patch("/:id/read", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .update({ isUnread: false })
      .eq("id", id)
      .select("id");

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0)
      return res.status(404).send("Conversation not found");

    res.status(204).send();
  });

  // SEND MESSAGE IN CHAT
  router.post("/:id/messages", async (req, res) => {
    const { id } = req.params;
    const { content, replyTo } = req.body;

    // Fetch messages in chat
    const { data: chat, error: fetchError } = await supabase
      .from("conversations")
      .select("messages")
      .eq("id", id)
      .single();

    if (fetchError || !chat)
      return res.status(404).send("Conversation not found");

    let replyToContext = null;
    if (replyTo && chat.messages) {
      const repliedToMessage = chat.messages.find((msg) => msg.id === replyTo);
      if (repliedToMessage) {
        replyToContext = {
          sender: repliedToMessage.sender,
          content: repliedToMessage.content,
        };
      }
    }

    // Generate new message object
    const userMessage = {
      id: dayjs().unix().toString(),
      content,
      timestamp: dayjs().format("HH:mm"),
      sender: "me",
      replyTo: replyTo || null,
      replyToContext,
    };

    let updatedMessages = [];
    let aiMessage;

    if (
      content.toLowerCase().includes("ai:") ||
      (replyTo && replyToContext.sender.includes("ai"))
    ) {
      // Prepare conversation history for Gemini
      const history = (chat.messages || []).map((msg) => ({
        role: "user",
        parts: [{ text: msg.content }],
      }));

      try {
        const chatSession = model.startChat({ history });
        const result = await chatSession.sendMessage(content);
        const aiContent = await result.response.text();

        aiMessage = {
          id: `${dayjs().unix().toString()}-ai`,
          content: aiContent,
          timestamp: dayjs().format("HH:mm"),
          sender: "ai-agent",
          replyTo: userMessage.id,
          isUnread: true,
        };

        await supabase
          .from("conversations")
          .update({ isUnread: true })
          .eq("id", id)
          .select("id");
      } catch (aiError) {
        console.error("Gemini API Error:", aiError);
        const statusCode = aiError.status || 500;
        const errorMessage = aiError.message || "Failed to get AI response.";
        return res.status(statusCode).json({ error: errorMessage });
      }

      updatedMessages = [...(chat.messages || []), userMessage, aiMessage];
    } else {
      updatedMessages = [...(chat.messages || []), userMessage];
    }

    // Update database
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        title: getParticipants(updatedMessages).participantList,
        messages: updatedMessages,
        lastMessage: aiMessage?.id
          ? `**${aiMessage?.sender}**: ${aiMessage?.content}`
          : `**${userMessage?.sender}**: \n${content}`,
        lastMessageDate: dayjs().format("YYYY-MM-DD HH:mm"),
        participantCount: getParticipants(updatedMessages).count,
      })
      .eq("id", id);

    if (updateError)
      return res.status(500).json({ error: updateError.message });

    res.status(201).json(aiMessage);
  });

  // EDIT MESSAGE IN CHAT
  router.patch("/:id/messages/:messageId", async (req, res) => {
    const { id, messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required for editing" });
    }

    // Fetch existing messages
    const { data: chat, error: fetchError } = await supabase
      .from("conversations")
      .select("messages")
      .eq("id", id)
      .single();

    if (fetchError || !chat) {
      return res.status(404).send("Conversation not found");
    }
    // Find the message and create updated array
    let updatedMessage = null;
    const updatedMessages = (chat.messages || []).map((msg) => {
      if (msg.id === messageId) {
        updatedMessage = { ...msg, content, edited: true }; // Mark message as edited
        return updatedMessage;
      }
      return msg;
    });

    if (!updatedMessage) {
      return res.status(404).send("Message not found");
    }

    // Update database
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ messages: updatedMessages })
      .eq("id", id);

    if (updateError)
      return res.status(500).json({ error: updateError.message });

    res.json(updatedMessage);
  });

  // INVITE TO CHAT
  router.post("/:id/invite", async (req, res) => {
    const { id } = req.params;
    const { sender } = req.body;

    // Fetch messages in chat
    const { data: chat, error: fetchError } = await supabase
      .from("conversations")
      .select("messages, title")
      .eq("id", id)
      .single();

    if (fetchError || !chat)
      return res.status(404).send("Conversation not found");

    const content = `${sender} is invited to the chat`;

    const userMessage = {
      id: dayjs().unix().toString(),
      content,
      timestamp: dayjs().format("HH:mm"),
      sender: sender,
    };

    const updatedMessages = [...(chat.messages || []), userMessage];

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        title: getParticipants(updatedMessages).participantList,
        messages: updatedMessages,
        lastMessage: `**${sender}**: \n${content}`,
        lastMessageDate: dayjs().format("YYYY-MM-DD HH:mm"),
        participantCount: getParticipants(updatedMessages).count,
      })
      .eq("id", id);

    if (updateError)
      return res.status(500).json({ error: updateError.message });

    res.status(201).send();
  });

  // GET PARTICIPANTS IN CHAT
  // router.get("/:id/participants", async (req, res) => {
  //   const { id } = req.params;

  //   // Fetch messages in chat
  //   const { data: chat, error: fetchError } = await supabase
  //     .from("conversations")
  //     .select("messages")
  //     .eq("id", id)
  //     .single();

  //   if (fetchError || !chat) {
  //     return res.status(404).send("Conversation not found");
  //   }

  //   const messages = chat.messages || [];
  //   const participants = [...new Set(messages.map((msg) => msg.sender))];

  //   res.json({
  //     participants,
  //     count: participants.length,
  //   });
  // });

  // INVITE TO CHAT
  router.patch("/:id/invite", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .update({
        messages: [],
        lastMessage: "Open to start conversation",
        lastMessageDate: dayjs().format("YYYY-MM-DD HH:mm"),
      })
      .eq("id", id)
      .select("id");

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0)
      return res.status(404).send("Conversation not found");

    res.status(204).send();
  });

  // DELETE MESSAGE BY ID
  router.delete("/:id/messages/:messageId", async (req, res) => {
    const { id, messageId } = req.params;

    // Fetch current chat
    const { data: chat, error: fetchError } = await supabase
      .from("conversations")
      .select("messages")
      .eq("id", id)
      .single();

    if (fetchError || !chat)
      return res.status(404).send("Conversation not found");

    // Filter out the message to be deleted
    const initialMessages = chat.messages || [];
    const updatedMessages = initialMessages.filter(
      (msg) => msg.id !== messageId
    );

    if (initialMessages.length === updatedMessages.length)
      return res.status(404).send("Message not found");

    // Update database
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ messages: updatedMessages })
      .eq("id", id);

    if (updateError)
      return res.status(500).json({ error: updateError.message });

    res.status(204).send();
  });

  return router;
};

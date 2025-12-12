const express = require("express");
const router = express.Router();

module.exports = (supabase, dayjs) => {
  // GET ALL CHATS
  router.get("/", async (req, res) => {
    const { data, error } = await supabase
      .from("conversations") // Note: Table name is 'conversations'
      .select("*")
      .order("id");

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
      .insert([{ id: Date.now().toString(), title: finalTitle, messages: [] }])
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
      .update({ messages: [], lastMessage: null, lastMessageDate: null })
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
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      sender: "me",
      replyTo: replyTo || null,
      replyToContext,
    };

    // Prepare conversation history for Gemini
    const history = (chat.messages || []).map((msg) => ({
      role: msg.sender === "me" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Call Gemini for an auto-reply
    let aiMessage;
    try {
      const chatSession = model.startChat({ history });
      const result = await chatSession.sendMessage(content);
      const aiContent = await result.response.text();

      aiMessage = {
        id: `${Date.now()}-ai`, // Ensure a unique ID
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        sender: "ai-agent",
        replyTo: userMessage.id,
      };
    } catch (aiError) {
      console.error("Gemini API Error:", aiError);
      const statusCode = aiError.status || 500;
      const errorMessage = aiError.message || "Failed to get AI response.";
      return res.status(statusCode).json({ error: errorMessage });
    }

    // Append both messages to database
    const updatedMessages = [...(chat.messages || []), userMessage, aiMessage];

    // Update database
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        messages: updatedMessages,
        lastMessage: aiMessage.content,
        lastMessageDate: new Date().toISOString(),
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

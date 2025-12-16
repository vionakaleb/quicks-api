const express = require("express");
const router = express.Router();

module.exports = (supabase, dayjs) => {
  // GET ALL TASKS
  router.get("/", async (req, res) => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("completed", { ascending: true })
      .order("id", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // CREATE TASK
  router.post("/", async (_req, res) => {
    const baseTitle = "New Task";

    // Filter unique titles
    const { data: existingTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("title")
      .like("title", `${baseTitle}%`);

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    let highestCounter = 0;
    if (existingTasks) {
      existingTasks.forEach((task) => {
        if (task.title === baseTitle) {
          highestCounter = Math.max(highestCounter, 1);
        } else {
          const match = task.title.match(/^New Task (\d+)$/);
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

    const newTask = {
      id: dayjs().unix().toString(),
      title: finalTitle,
      description: "",
      date: "",
      tags: ["New"],
      completed: false,
    };

    // Calculate remaining days
    if (newTask.date) {
      const targetDate = dayjs(newTask.date).startOf("day");
      const currentDate = dayjs().startOf("day");
      newTask.daysLeft = targetDate.diff(currentDate, "day");
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert([newTask])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  });

  // UPDATE TASK BY ID
  router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { completed, tags, title, description, date } = req.body;

    // Prepare update object
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (completed !== undefined) updates.completed = completed;
    if (tags !== undefined) updates.tags = tags;
    if (date !== undefined) {
      updates.date = date;

      // Reset time part to compare dates
      const targetDate = dayjs(date).startOf("day");
      const currentDate = dayjs().startOf("day");

      updates.daysLeft = targetDate.diff(currentDate, "day");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).send("Task not found");

    res.json(data[0]);
  });

  // DELETE TASK BY ID
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).send("Task not found");

    res.status(204).send();
  });

  return router;
};

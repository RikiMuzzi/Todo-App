const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require('path');
const cors = require('cors')
app.use(cors());
// Set the view engine to EJS
app.set('view engine', 'ejs');

// Middleware for parsing application/x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files directory
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const mongoDBUri = "mongodb+srv://riccardomuzzi02:Nutella123@muzzicluster.qh3kblb.mongodb.net/?retryWrites=true&w=majority&appName=MuzziCluster";
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true });

// Content variables
const homeContent = "Lorem ipsum dolor sit amet...";
const aboutContent = "Lorem ipsum dolor sit amet...";
const contactContent = "Lorem ipsum dolor sit amet...";

// Mongoose schema for tasks
const todoSchema = new mongoose.Schema({
    header: String,
    completed: { type: Boolean, default: false }
});

const Todo = mongoose.model("Todo", todoSchema);

app.get("/", async (req, res) => {
    try {
        const tasks = await Todo.find({});
        res.render("home", {content: homeContent, tasks });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching tasks');
    }
});

app.get("/about", (req, res) => {
    res.render("about", { content: aboutContent });
});

app.get("/contact", (req, res) => {
    res.render("contact", { content: contactContent });
});

app.get("/compose", (req, res) => {
    res.render("compose");
});

app.post("/compose", async (req, res) => {
    const newTodo = new Todo({
        header: req.body.title,
        completed: req.body.completed,
    });
    try {
        // Salvo il nuovo todo nel database
        await newTodo.save();
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving post');
    }
});

app.post("/tasks/:taskId/complete", async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const task = await Todo.findById(taskId);
        if (!task) {
            return res.status(404).send("Task non trovata");
        }
        // Inverto lo stato
        const actual = task.completed;
        task.completed = !actual;
        await task.save();
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Errore durante il completamento della task");
    }
});

app.post("/tasks/:taskId/delete", async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const deletedTask = await Todo.findByIdAndDelete(taskId);
        if (!deletedTask) {
            return res.status(404).send("Task non trovata");
        }
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Errore durante l'eliminazione della task");
    }
});

// Aggiungi una nuova route per gestire la richiesta POST dal pulsante "Clear All"
app.post("/clear", async (req, res) => {
    try {
        // Elimina tutti i todos dalla collezione
        await Todo.deleteMany({});
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Errore durante l'eliminazione di tutti i todos");
    }
});

// Listen on default port 3000
app.listen(3000);

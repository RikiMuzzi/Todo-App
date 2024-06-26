const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const _ = require("lodash");
const cors = require("cors");
const expressSession = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const markdown = require("markdown").markdown;

const stripHtmlTags = (text) => text.replace(/<\/?[^>]+(>|$)/g, ""); // Function to strip HTML tags

// Middleware setup
app.use(cors());
app.set("view engine", "ejs"); // Set EJS as the view engine
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/scripts", express.static(path.join(__dirname, "node_modules/markdown/lib")));

app.use(
  expressSession({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to 'true' only for HTTPS
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash(); // Make flash messages available in views
  res.locals.username = req.isAuthenticated() ? req.user.username : null; // Provide username if authenticated
  next(); // Continue with the next middleware
});

app.use(express.static(path.join(__dirname, "public")));

// Database connection
const mongoDBUri = "mongodb+srv://riccardomuzzi02:Nutella123@muzzicluster.qh3kblb.mongodb.net/?retryWrites=true&w=majority&appName=MuzziCluster";
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on("connected", () => console.log("Connected to MongoDB"));
mongoose.connection.on("reconnected", () => console.log("Reconnected to MongoDB"));
mongoose.connection.on("disconnected", () => console.log("Disconnected from MongoDB"));
mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err));

// Close MongoDB connection on SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed due to application termination");
    process.exit(0);
  });
});

const homeContent = "Contenuto della home";

// Mongoose schema for tasks
const todoSchema = new mongoose.Schema({
  header: String,
  completed: { type: Boolean, default: false },
  author: String,
});

const timerSchema = new mongoose.Schema({
  stTime: Number,
  psTime: Number,
  rep: Number,
  timeStudied: { type: Number, default: 0},
  percent: { type: Number, default: 0},
  live: { type: Boolean, default: true },
  author: String,
})

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
  
const Todo = mongoose.model("Todo", todoSchema);
const Timer = mongoose.model("Timer", timerSchema);
const User = mongoose.model("User", userSchema);
  
  // Passport setup for user authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          return done(null, false, { message: "Incorrect username or password." });
        }
  
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Incorrect username or password." });
        }
  
        return done(null, user); // Successful authentication
      } catch (err) {
        return done(err); // Error during authentication
      }
    })
  );
  
  passport.serializeUser((user, done) => {
    done(null, user._id); // serializza l'id utente
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user); //chiama done(), funzione di passport che gestisce success/error o fail
    } catch (err) {
      done(err); // Handle errors during deserialization
    }
  });
  
  // middleware per mantenere l'autenticazione dell'utente
  const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next(); // User is authenticated
    }
    res.redirect("/login"); // Redirect if not authenticated
  };
  
  // Routes for login and registration
  app.get("/login", (req, res) => {
    res.render("login", { username: req.user ? req.user.username : null });
  });
  
  
  app.post( //https://betaweb.github.io/flashjs/ ma non implementato nella versione corrente
    "/login",
    passport.authenticate("local", {
      successRedirect: "/", // Redirect after successful login
      failureRedirect: "/login", // Redirect after failed login
      failureFlash: true, // Enable flash messages
    })
  );
  
  app.get("/register", (req, res) => {
    res.render("register", { username: req.user ? req.user.username : null });
  });
  
  app.post("/register", async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newUser = new User({
        username,
        password: hashedPassword, // Store the hashed password
      });
  
      await newUser.save();
  
      req.login(newUser, (err) => {
        if (err) {
          return res.status(500).send("Error during login after registration.");
        }
  
        res.redirect("/"); // Redirect after successful registration
      });
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).send("Registration failed."); // Handle registration errors
    }
  });
  
  app.get("/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).send("Error during logout.");
      }
  
      res.redirect(302, "/login"); // Use a valid status code and clear redirect
    });
  });
  
// Main routes

app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
  
    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found"); // If user is not found
    }

    const tasks = await Todo.find({ author: user.username });
    res.render("home", { 
      username: user.username, content: homeContent, tasks: tasks 
    }); // Passa la variabile tasks al template 'home.ejs'
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching tasks');
  }
});

app.post("/compose", ensureAuthenticated, async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
  
    if (!user) {
      return res.status(404).send("User not found");
    }
  
    const newTodo = new Todo({
        header: req.body.title,
        completed: req.body.completed,
        author: user.username,
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

app.post("/clear", async (req, res) => {
    try {
        // Elimina tutti i todos dalla collezione
        await Todo.deleteMany({});
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Errore durante l'eliminazione di tutte le task");
    }
});

// gestione Timer

app.get("/tomato", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found"); // If user is not found
    }

    // Ottieni l'ID del timer e passalo alla vista tomato.ejs
    const timer = await Timer.findOne({ author: user.username }); // Modifica questa query in base alla tua logica di business
    const timerId = timer ? timer._id : null; // Controlla se il timer esiste e ottieni il suo ID

    res.render("tomato", { 
      username: user.username,
      timer: timer // Passa l'oggetto timer alla vista
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching tasks');
  }
});


app.get("/timers/:timerId", ensureAuthenticated, async (req, res) => {
  const timerId = req.params.timerId; // Ottieni l'ID del timer dalla richiesta
  try {
    const timer = await Timer.findById(timerId); // Cerca il timer nel database per ID

    if (!timer) {
      return res.status(404).send("Timer non trovato"); 
    }

    // Se il timer esiste, restituisci l'ID al client
    res.json({ success: true, timerId: timer._id });
  } catch (error) {
    console.error("Errore durante il recupero del timer:", error);
    res.status(500).send("Errore durante il recupero del timer"); 
  }
});

app.post("/timers/:timerId/update", async (req, res) => {
  try {
      const timerId = req.params.timerId; 
      const timer = await Timer.findById(timerId);
      if (!timer) {
        console.log("Tomato not founded");
        return res.status(404).send("Tomato not founded");
      }

      timer.live = req.body.liveNow; 
      timer.timeStudied = req.body.completed;
      timer.percent = req.body.percentual;

      await timer.save();
      console.log(timer);
      
      res.status(200).send("Timer updated successfully"); 
  } catch (error) {
      console.error(error);
      console.log("unlucky");
      res.status(500).send("Error");
  }
});

app.post("/saveTomato", ensureAuthenticated, async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).send("User not found");
  }

  const newTimer = new Timer({
      stTime: req.body.studyTime,
      psTime: req.body.pauseTime,
      rep: req.body.repeat,
      author: user.username,
  });

  try {
    // Salva il nuovo timer nel database
    await newTimer.save();
    console.log(newTimer);

    // Restituisci l'ID del timer corrente come parte della risposta
    res.status(200).json({ timerId: newTimer._id });
  } catch (error) {
    console.error(error);
    res.status(500).send('Errore durante il salvataggio del timer');
  }
});



// Listen on default port 3000
app.listen(3000);
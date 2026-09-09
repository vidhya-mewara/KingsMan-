import express from 'express';
import mongoose from 'mongoose';
import Player from './model/playerProfile.js';
import path from 'path';
import ejsMate from 'ejs-mate';
import upload from './middleware/upload.js';
import wrapAsync from './utils/wrapasync.js';
import ExpressError from './utils/expressErrors.js';
import {playerSchema,userSchema} from './schema.js';
import methodOverride from "method-override";
import cookieParser from 'cookie-parser';
import session from 'express-session';
import flash from 'connect-flash';
const app = express();
const mongoUrl = 'mongodb://127.0.0.1:27017/playerDB';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import 'dotenv/config';


async function main() {
  await mongoose.connect(mongoUrl);
}

main()
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));



app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set('views', path.join(import.meta.dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(methodOverride("_method"));

// const validatePlayer = (req, res, next) => {
//   const { error } = playerSchema.validate(req.body);

//   if (error) {
//     throw new ExpressError(400, error.details[0].message);
//   }

//   next();
// };

const sessionoptions = {
  secret: "kingsmansecret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  }
}


app.use(session(sessionoptions));
app.use(flash());


app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  // res.locals.currUser = req.user;

  next();
})
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const validateUser = (req, res, next) => { 
  const { error } = userSchema.validate(req.body); 
    if (error) { 
      throw new ExpressError(400, error.details[0].message); 
    } 
  next(); 
};



app.get("/players", wrapAsync(async (req, res) => {
  let players = await Player.find({});
  res.render("players", { players });
}))
app.get("/players/new", (req, res) => {
  res.render("new.ejs");
});

app.get("/players/:id",wrapAsync( async(req,res) => {
  const { id } = req.params;
  let player = await Player.findById(id);
  res.render("playerProfile", { player });
})
)
app.post(
  "/players",
  upload.single("verificationScreenshot"),
  wrapAsync(async (req, res) => {

    // Make sure screenshot was uploaded
    if (!req.file) {
      throw new ExpressError(400, "Verification screenshot is required");
    }

    // Checkbox → boolean
    const inTeam = req.body.inTeam === "true";

    // Single role → array
    const roles = Array.isArray(req.body.role)
      ? req.body.role
      : [req.body.role];

    // Single agent → array
    const selectedAgents = Array.isArray(req.body.agents)
      ? req.body.agents
      : [req.body.agents];

    // Prepare data
    const playerData = {
      name: req.body.name,
      ign: req.body.ign,
      uid: req.body.uid,

      role: roles,
      agents: selectedAgents,

      country: req.body.country,
      region: req.body.region,

      inTeam: inTeam,
      teamName: req.body.teamName || "",

      socialMedia: {
        instagram: req.body.socialMedia?.instagram || "",
        facebook: req.body.socialMedia?.facebook || "",
        youtube: req.body.socialMedia?.youtube || "",
        twitch: req.body.socialMedia?.twitch || "",
        kick: req.body.socialMedia?.kick || ""
      },

      verificationScreenshot: req.file.path
    };
   
    // Joi validation
    const { error } = playerSchema.validate(playerData);

    if (error) {
      throw new ExpressError(400, error.details[0].message);
    }

    // Create and save MongoDB document
    const player = new Player(playerData);

    await player.save();
    req.flash("success", "Player profile created successfully!");

    res.redirect("/players");
  })
);


app.get("/players/:id/edit", wrapAsync(async (req, res) => {
  const { id } = req.params;

  const player = await Player.findById(id);

  if (!player) {
    throw new ExpressError(404, "Player Not Found");
  }

  res.render("edit", { player });
}));


app.put("/players/:id", wrapAsync(async (req, res) => {

  const { id } = req.params;

  const roles = Array.isArray(req.body.role)
    ? req.body.role
    : [req.body.role];

  const selectedAgents = Array.isArray(req.body.agents)
    ? req.body.agents
    : [req.body.agents];

  const inTeam = req.body.inTeam === "true";

  const updateData = {
    ign: req.body.ign,

    role: roles,

    agents: selectedAgents,

    inTeam: inTeam,

    teamName: inTeam
      ? req.body.teamName || ""
      : "",

    socialMedia: {
      instagram: req.body.socialMedia?.instagram || "",
      facebook: req.body.socialMedia?.facebook || "",
      youtube: req.body.socialMedia?.youtube || "",
      twitch: req.body.socialMedia?.twitch || "",
      kick: req.body.socialMedia?.kick || ""
    }
  };

  const { error } = playerSchema.validate({
    ...updateData,

    // Keep unchanged fields for Joi validation
    name: "existing",
    uid: "existing",
    country: "existing",
    region: "existing",

    verificationScreenshot: "existing"
  });

  if (error) {
    throw new ExpressError(400, error.details[0].message);
  }

  const player = await Player.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!player) {
    throw new ExpressError(404, "Player Not Found");
  }
  req.flash("success", "Player profile updated successfully!");
  res.redirect(`/players/${id}`);
  
}));
app.delete("/players/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;

  const deletedPlayer = await Player.findByIdAndDelete(id);

  if (!deletedPlayer) {
    throw new ExpressError(404, "Player Not Found");
  }

  res.redirect("/players");
}));

app.get("/", (req,res) => {
  res.send("Welcome to the Kingsman Player Profile API");
});
app.post("/register", wrapAsync(async (req, res) => {

  const { name, email, password } = req.body;

  // Validate form data
  const { error } = userSchema.validate({
    name,
    email,
    password
  });

  if (error) {
    throw new ExpressError(400, error.details[0].message);
  }

  // Check existing user
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    req.flash("error", "Email is already registered.");
    return res.redirect("/register");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP
  const hashedOtp = await bcrypt.hash(otp, 10);

  // Create user
  const user = new User({
    name,
    email,
    password: hashedPassword,
    otp: hashedOtp,
    otpExpires: new Date(Date.now() + 5 * 60 * 1000),
    isVerified: false
  });

  // Save to MongoDB
  await user.save();

  // Send OTP
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "KingsMan Email Verification",
    html: `
            <h2>KingsMan Email Verification</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>This OTP expires in 5 minutes.</p>
        `
  });

  req.session.verifyUserId = user._id;

  req.flash("success", "OTP sent to your email.");
  res.redirect("/verify-otp");
}));


app.get("/verify-otp", (req, res) => {
  if (!req.session.verifyUserId) {
    req.flash("error", "Please register first.");
    return res.redirect("/register");
  }

  res.render("verify-otp");
});

app.post("/verify-otp", wrapAsync(async (req, res) => {

  const { otp } = req.body;

  const userId = req.session.verifyUserId;

  if (!userId) {
    req.flash("error", "Verification session expired.");
    return res.redirect("/register");
  }

  const user = await User.findById(userId);

  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect("/register");
  }

  // Check OTP expiry
  if (!user.otpExpires || user.otpExpires < new Date()) {

    user.otp = null;
    user.otpExpires = null;

    await user.save();

    req.flash("error", "OTP has expired. Please request a new one.");
    return res.redirect("/verify-otp");
  }

  // Compare OTP
  const isValid = await bcrypt.compare(otp, user.otp);

  if (!isValid) {
    req.flash("error", "Invalid OTP.");
    return res.redirect("/verify-otp");
  }

  // Verification successful
  user.isVerified = true;
  user.otp = null;
  user.otpExpires = null;

  await user.save();

  // Remove temporary verification session
  delete req.session.verifyUserId;

  req.flash("success", "Email verified successfully!");

  res.redirect("/login");
}));

app.all(/.*/, (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  // res.status(statusCode).send(message);
  res.status(statusCode).render("error", { message });
})

app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
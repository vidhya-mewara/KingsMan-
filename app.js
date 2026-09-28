import 'dotenv/config';
import fs from "fs";
import express from 'express';
import mongoose from 'mongoose';
import Player from './model/playerProfile.js';
import path from 'path';
import ejsMate from 'ejs-mate';
import upload from './middleware/upload.js';
import wrapAsync from './utils/wrapasync.js';
import ExpressError from './utils/expressErrors.js';
import {playerSchema,userSchema} from './schema.js';
import User from './model/userSchema.js';
import methodOverride from "method-override";
import cookieParser from 'cookie-parser';
import session from 'express-session';
import flash from 'connect-flash';
const app = express();
const mongoUrl = 'mongodb://127.0.0.1:27017/playerDB';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { requireLogin, requireAdmin, saveRedirectUrl, loadUser, hasNoPlayer, isPlayerOwner } from './middleware.js';
import Slider from './model/slider.js';
import Promotion from "./model/promotion.js";
import sliderUpload from "./middleware/sliderUpload.js";
import promotionUpload from "./middleware/promotionUpload.js";
import Match from "./model/match.js";
import Event from "./model/event.js";
import eventUpload from "./middleware/eventUpload.js";
import Team from "./model/teams.js";
import Qualifier from "./model/qualifier.js";
import TournamentGroup from "./model/tournamentGroup.js";
import Standing from "./model/standing.js";
import Playoff from "./model/playoff.js";


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
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    // secure: true 
  }
}


app.use(session(sessionoptions));
app.use(flash());

app.use(saveRedirectUrl);
app.use(loadUser);

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },

  tls: {
    rejectUnauthorized: false
  }
});
const validateUser = (req, res, next) => { 
  const { error } = userSchema.validate(req.body); 
    if (error) { 
      throw new ExpressError(400, error.details[0].message); 
    } 
  next(); 
};

app.use((req, res, next) => {

  const path = req.path;

  if (path.startsWith("/players")) {
    res.locals.currentPage = "players";
  }
  else if (path.startsWith("/matches")) {
    res.locals.currentPage = "matches";
  }
  else if (path.startsWith("/tournament-events")) {
    res.locals.currentPage = "tournament-events";
  }
  else if (path.startsWith("/contact")) {
    res.locals.currentPage = "contact";
  }
  else {
    res.locals.currentPage = "";
  }

  next();
});
app.get("/players", wrapAsync(async (req, res) => {
  const {
    search = "",
    country = "",
    region = "",
    role = "",
    verificationStatus = "",
    inTeam = "",
    page = "1"
  } = req.query;

  const limit = 20;
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};

  // ==========================================
  // SEARCH IGN OR UID
  // ==========================================
  if (search.trim()) {
    const searchText = search.trim();

    // Escape regex characters so user input is safe
    const escapedSearch = searchText.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filter.$or = [
      {
        ign: {
          $regex: escapedSearch,
          $options: "i"
        }
      },
      {
        uid: {
          $regex: escapedSearch,
          $options: "i"
        }
      }
    ];
  }

  // ==========================================
  // COUNTRY
  // ==========================================
  if (country.trim()) {
    filter.country = country.trim();
  }

  // ==========================================
  // REGION
  // ==========================================
  if (region.trim()) {
    filter.region = region.trim();
  }

  // ==========================================
  // ROLE
  // ==========================================
  if (role.trim()) {
    filter.role = role.trim();
  }

  // ==========================================
  // VERIFICATION
  // ==========================================
  if (verificationStatus.trim()) {
    filter.verificationStatus = verificationStatus.trim();
  }

  // ==========================================
  // TEAM STATUS
  // ==========================================
  if (inTeam === "true") {
    filter.inTeam = true;
  }

  if (inTeam === "false") {
    filter.inTeam = false;
  }

  // ==========================================
  // TOTAL COUNT
  // ==========================================
  const totalPlayers = await Player.countDocuments(filter);

  const totalPages = Math.ceil(totalPlayers / limit);

  const safePage =
    totalPages > 0
      ? Math.min(currentPage, totalPages)
      : 1;

  const skip = (safePage - 1) * limit;

  // ==========================================
  // GET PLAYERS
  // ==========================================
  const players = await Player.find(filter)
    .sort({
      createdAt: -1,
      _id: -1
    })
    .skip(skip)
    .limit(limit)
    .lean();

  // ==========================================
  // FILTER OPTIONS
  // ==========================================
  const [
    countries,
    regions
  ] = await Promise.all([
    Player.distinct("country"),
    Player.distinct("region")
  ]);

  countries.sort((a, b) =>
    a.localeCompare(b)
  );

  regions.sort((a, b) =>
    a.localeCompare(b)
  );

  res.render("players", {
    players,

    filters: {
      search: search.trim(),
      country,
      region,
      role,
      verificationStatus,
      inTeam
    },

    countries,
    regions,

    pagination: {
      currentPage: safePage,
      totalPages,
      totalPlayers,
      limit
    }
  });
}));

app.get(
  "/players/new",
  requireLogin,
  hasNoPlayer,
  (req, res) => {
    res.render("new.ejs");
  }
);

app.get("/players/:id",wrapAsync( async(req,res) => {
  const { id } = req.params;
  let player = await Player.findById(id);
  res.render("playerProfile", { player });
})
)

// Create player profile

app.post(
  "/players",
  requireLogin,
  hasNoPlayer,
  upload.single("verificationScreenshot"),
  wrapAsync(async (req, res) => {

    // Get currently logged-in user
    const currentUser = await User.findById(req.session.userId);

    if (!currentUser) {
      throw new ExpressError(401, "User account not found");
    }

    // Prevent user from creating multiple player profiles
    if (currentUser.player) {
      req.flash("error", "You already have a player profile.");
      return res.redirect(`/players/${currentUser.player}`);
    }

    // Screenshot required
    if (!req.file) {
      throw new ExpressError(
        400,
        "Verification screenshot is required"
      );
    }

    // Checkbox → boolean
    const inTeam = req.body.inTeam === "true";

    // Role → array
    const roles = Array.isArray(req.body.role)
      ? req.body.role
      : [req.body.role];

    // Agents → array
    const selectedAgents = Array.isArray(req.body.agents)
      ? req.body.agents
      : [req.body.agents];

    // Prepare player data
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

      // verificationScreenshot: req.file.path,
      verificationScreenshot: "/uploads/players/" + req.file.filename,

      //  THIS FIXES YOUR ERROR
      owner: currentUser._id.toString()
    };

    // Joi validation
    const { error } = playerSchema.validate(playerData);

    if (error) {
      throw new ExpressError(
        400,
        error.details[0].message
      );
    }

    // Create player
    const player = new Player(playerData);

    await player.save();

    // Link player to user
    currentUser.player = player._id;

    await currentUser.save();

    req.flash(
      "success",
      "Player profile created successfully!"
    );

    res.redirect(`/players/${player._id}`);
  })
);



// Edit player profile
app.get(
  "/players/:id/edit",
  requireLogin,
  isPlayerOwner,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    const player = await Player.findById(id);

    if (!player) {
      throw new ExpressError(404, "Player Not Found");
    }

    res.render("edit", { player });
  })
);


// update player profile
app.put(
  "/players/:id",
  requireLogin,
  isPlayerOwner,
  wrapAsync(async (req, res) => {

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
// delete player profile
app.delete(
  "/players/:id",
  requireLogin,
  isPlayerOwner,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    const deletedPlayer = await Player.findByIdAndDelete(id);

    if (!deletedPlayer) {
      throw new ExpressError(404, "Player Not Found");
    }

    const user = await User.findById(req.session.userId);

    if (user) {
      user.player = null;
      await user.save();
    }

    req.flash(
      "success",
      "Player profile deleted successfully!"
    );

    res.redirect("/players");
  })
);


app.get("/register", (req, res) => {
  res.render("register");
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

  // Check if email already exists
  const existingUser = await User.findOne({ email });

  // If email belongs to a verified account
  if (existingUser && existingUser.isVerified) {
    req.flash("error", "Email is already registered.");
    return res.redirect("/register");
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Hash OTP
  const hashedOtp = await bcrypt.hash(otp, 10);

  let user;

  if (existingUser && !existingUser.isVerified) {

    // Existing account but not verified
    existingUser.name = name;
    existingUser.password = hashedPassword;
    existingUser.otp = hashedOtp;
    existingUser.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    existingUser.otpAttempts = 0;
    existingUser.otpLastSent = new Date();

    await existingUser.save();

    user = existingUser;

  } else {

    // Completely new user
    user = new User({
      name,
      email,
      password: hashedPassword,
      otp: hashedOtp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
      otpAttempts: 0,
      otpLastSent: new Date(),
      isVerified: false
    });

    await user.save();
  }

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

  // Save user ID in verification session
  req.session.verifyUserId = user._id;

  req.flash(
    "success",
    "OTP sent to your email."
  );

  res.redirect("/verify-otp");
}));
// Show OTP verification page
app.get("/verify-otp", (req, res) => {

  if (!req.session.verifyUserId) {
    req.flash("error", "Please register first.");
    return res.redirect("/register");
  }

  res.render("verify-otp");
});
// Resend OTP
app.post("/resend-otp", wrapAsync(async (req, res) => {

  const userId = req.session.verifyUserId;

  if (!userId) {
    req.flash("error", "Please register first.");
    return res.redirect("/register");
  }

  const user = await User.findById(userId);

  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect("/register");
  }

  // Don't resend if already verified
  if (user.isVerified) {
    req.flash("success", "Your email is already verified.");
    return res.redirect("/login");
  }

  // Wait 60 seconds between OTP requests
  if (
    user.otpLastSent &&
    Date.now() - user.otpLastSent.getTime() < 60 * 1000
  ) {

    const remainingSeconds = Math.ceil(
      (60 * 1000 - (Date.now() - user.otpLastSent.getTime())) / 1000
    );

    req.flash(
      "error",
      `Please wait ${remainingSeconds} seconds before requesting another OTP.`
    );

    return res.redirect("/verify-otp");
  }

  // Generate new OTP
  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // Hash OTP
  const hashedOtp = await bcrypt.hash(otp, 10);

  // Update user
  user.otp = hashedOtp;
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  user.otpAttempts = 0;
  user.otpLastSent = new Date();

  await user.save();

  // Send new OTP
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "KingsMan - New Verification OTP",
    html: `
      <h2>KingsMan Email Verification</h2>
      <p>Your new OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP expires in 5 minutes.</p>
    `
  });

  req.flash("success", "A new OTP has been sent to your email.");

  res.redirect("/verify-otp");
}));
// Verify OTP
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
  if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {

    user.otp = null;
    user.otpExpires = null;

    await user.save();

    req.flash(
      "error",
      "OTP has expired. Please request a new one."
    );

    return res.redirect("/verify-otp");
  }

  // Compare entered OTP with hashed OTP
  const isValid = await bcrypt.compare(otp, user.otp);

  if (!isValid) {
    user.otpAttempts += 1;
    await user.save();

    req.flash("error", "Invalid OTP.");
    return res.redirect("/verify-otp");
  }

  // Verification successful
  user.isVerified = true;
  user.otp = null;
  user.otpExpires = null;
  user.otpAttempts = 0;

  await user.save();

  // Remove temporary verification session
  delete req.session.verifyUserId;

  // Log the user in
  req.session.userId = user._id;
  req.session.userRole = user.role;

  req.flash("success", "Email verified successfully!");

  res.redirect("/");
}));



app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", wrapAsync(async (req, res) => {

  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    req.flash("error", "Invalid email or password.");
    return res.redirect("/login");
  }

  if (!user.isVerified) {
    req.flash("error", "Please verify your email first.");
    req.session.verifyUserId = user._id;
    return res.redirect("/verify-otp");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    req.flash("error", "Invalid email or password.");
    return res.redirect("/login");
  }

  req.session.userId = user._id;
  req.session.userRole = user.role;

  req.flash("success", "Logged in successfully!");

  res.redirect("/");
}));

app.get("/logout", (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      return res.redirect("/");
    }

    res.redirect("/");
  });

});

// GET CONTACT PAGE

app.get("/contact", (req, res) => {

  res.render("contact", {
    currUser: req.user || null,
    success: null,
    error: null
  });

});


// POST CONTACT FORM
app.post("/contact", async (req, res) => {

  try {

    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      req.flash("error", "Please fill in all fields.");
      return res.redirect("/contact");
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `KingsMan Support: ${subject}`,

      text: `
Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
            `
    });

    req.flash("success", "Your message has been sent successfully.");

    res.redirect("/contact");

  } catch (error) {

    console.error("Contact form error:", error);

    req.flash(
      "error",
      "Something went wrong while sending your message."
    );

    res.redirect("/contact");
  }

});

app.get("/", async (req, res) => {
  try {
    const sliders = await Slider.find({
      active: true
    }).sort({
      position: 1
    });

    const promotion = await Promotion.findOne({
      active: true
    });
    const ongoingMatches = await Match.find({
      status: "ongoing"
    }).sort({ date: 1 }).limit(3);

    const upcomingMatches = await Match.find({
      status: "upcoming"
    }).sort({ date: 1 }).limit(3);

    const pastMatches = await Match.find({
      status: "past"
    }).sort({ date: -1 }).limit(3);

    const ongoingEvents = await Event.find({
      status: "ongoing"
    }).sort({ startDate: 1 }).limit(3);

    const upcomingEvents = await Event.find({
      status: "upcoming"
    }).sort({ startDate: 1 }).limit(3);

    const completedEvents = await Event.find({
      status: "completed"
    }).sort({ endDate: -1 }).limit(3);

    res.render("home", {
      sliders,
      promotion,

      ongoingMatches,
      upcomingMatches,
      pastMatches,

      ongoingEvents,
      upcomingEvents,
      completedEvents
    });

  } catch (error) {
    console.error("HOME ERROR:", error);
    res.status(500).send("Home Page Error");
  }
});
// ============================================================
// ADMIN SLIDER MANAGEMENT
// ============================================================

// ===============================
// VIEW ALL SLIDERS
// ===============================

app.get(
  "/admin/sliders",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const sliders = await Slider.find({})
      .sort({ position: 1, createdAt: -1 });

    res.render("admin/sliders", {
      sliders
    });

  })
);


// ===============================
// ADD SLIDER
// ===============================

app.post(
  "/admin/sliders",
  requireLogin,
  requireAdmin,
  sliderUpload.single("image"),
  wrapAsync(async (req, res) => {

    if (!req.file) {
      req.flash("error", "Slider image is required.");
      return res.redirect("/admin/sliders");
    }

    const slider = new Slider({

      image: "/uploads/sliders/" + req.file.filename,

      title: req.body.title,

      description: req.body.description || "",

      eventDate: req.body.eventDate || "",

      eventLocation: req.body.eventLocation || "",

      eventDescription: req.body.eventDescription || "",

      eventLink: req.body.eventLink || "",

      buttonText: req.body.buttonText || "",

      buttonLink: req.body.buttonLink || "",

      active: req.body.active === "true",

      position: Number(req.body.position) || 0

    });

    await slider.save();

    req.flash("success", "Slider added successfully.");

    res.redirect("/admin/sliders");

  })
);


// ===============================
// EDIT SLIDER PAGE
// ===============================

app.get(
  "/admin/sliders/:id/edit",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const slider = await Slider.findById(req.params.id);

    if (!slider) {
      req.flash("error", "Slider not found.");
      return res.redirect("/admin/sliders");
    }

    res.render("admin/edit-slider", {
      slider
    });

  })
);


// ===============================
// UPDATE SLIDER
// ===============================

app.put(
  "/admin/sliders/:id",
  requireLogin,
  requireAdmin,
  sliderUpload.single("image"),
  wrapAsync(async (req, res) => {

    const slider = await Slider.findById(req.params.id);

    if (!slider) {
      req.flash("error", "Slider not found.");
      return res.redirect("/admin/sliders");
    }

    const oldImage = slider.image;


    // ===============================
    // UPDATE CONTENT
    // ===============================

    slider.title = req.body.title;

    slider.description =
      req.body.description || "";

    slider.eventDate =
      req.body.eventDate || "";

    slider.eventLocation =
      req.body.eventLocation || "";

    slider.eventDescription =
      req.body.eventDescription || "";

    slider.eventLink =
      req.body.eventLink || "";

    slider.buttonText =
      req.body.buttonText || "";

    slider.buttonLink =
      req.body.buttonLink || "";

    slider.position =
      Number(req.body.position) || 0;

    slider.active =
      req.body.active === "true";


    // ===============================
    // REPLACE IMAGE
    // ===============================

    if (req.file) {

      slider.image =
        "/uploads/sliders/" + req.file.filename;

    }


    await slider.save();


    // ===============================
    // DELETE OLD IMAGE
    // ONLY AFTER DATABASE UPDATE
    // ===============================

    if (req.file && oldImage) {

      const oldImagePath = path.join(
        import.meta.dirname,
        "public",
        oldImage.replace(/^\/+/, "")
      );

      if (fs.existsSync(oldImagePath)) {

        fs.unlinkSync(oldImagePath);

        console.log(
          "OLD SLIDER IMAGE DELETED:",
          oldImagePath
        );

      }

    }


    req.flash(
      "success",
      "Slider updated successfully."
    );

    res.redirect("/admin/sliders");

  })
);


// ===============================
// DELETE SLIDER
// ===============================

app.delete(
  "/admin/sliders/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const slider = await Slider.findById(req.params.id);

    if (!slider) {
      req.flash("error", "Slider not found.");
      return res.redirect("/admin/sliders");
    }


    // ===============================
    // SAVE IMAGE PATH
    // ===============================

    const imagePath = slider.image;


    // ===============================
    // DELETE DATABASE RECORD
    // ===============================

    await Slider.findByIdAndDelete(req.params.id);


    // ===============================
    // DELETE IMAGE FROM SERVER
    // ===============================

    if (imagePath) {

      const fullImagePath = path.join(
        import.meta.dirname,
        "public",
        imagePath.replace(/^\/+/, "")
      );

      if (fs.existsSync(fullImagePath)) {

        fs.unlinkSync(fullImagePath);

        console.log(
          "SLIDER IMAGE DELETED:",
          fullImagePath
        );

      }

    }


    req.flash(
      "success",
      "Slider deleted successfully."
    );

    res.redirect("/admin/sliders");

  })
);
app.get("/events/:id", async (req, res) => {

  try {

    const slider = await Slider.findById(req.params.id);

    if (!slider) {
      return res.status(404).send("Event not found.");
    }

    res.render("events/show", {
      slider
    });

  } catch (error) {

    console.error("EVENT PAGE ERROR:", error);

    res.status(500).send("Unable to load event.");

  }

});
app.get("/test-promotion", async (req, res) => {
  try {
    const promotions = await Promotion.find();

    console.log("PROMOTIONS:", promotions);

    res.json(promotions);
  } catch (error) {
    console.error("PROMOTION ERROR:", error);
    res.status(500).send("Promotion Error");
  }
});
app.get("/matches", wrapAsync(async (req, res) => {

  const ongoingMatches = await Match.find({
    status: "ongoing"
  }).sort({ date: 1 });

  const upcomingMatches = await Match.find({
    status: "upcoming"
  }).sort({ date: 1 });

  const pastMatches = await Match.find({
    status: "past"
  }).sort({ date: -1 });

  res.render("matches/index", {
    ongoingMatches,
    upcomingMatches,
    pastMatches
  });

}));
app.get("/matches/:id", wrapAsync(async (req, res) => {

  const match = await Match.findById(req.params.id)
    .populate("players.player");

  if (!match) {
    throw new ExpressError(404, "Match Not Found");
  }

  const teamAPlayers = match.players.filter(
    player => player.team === "teamA"
  );

  const teamBPlayers = match.players.filter(
    player => player.team === "teamB"
  );

  res.render("matches/show", {
    match,
    teamAPlayers,
    teamBPlayers
  });
}));
// =========================================================
// ADMIN MATCH COMMAND CENTER
// =========================================================

app.get(
  "/admin/matches",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const matches = await Match.find({})
      .sort({ date: -1 })
      .populate("players.player", "ign name");

    res.render("admin/matches/index", {
      matches
    });

  })
);
app.get(
  "/admin/matches/new",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const players = await Player.find({
        verificationStatus: "verified"
      }).sort({ ign: 1 });

      res.render("admin/matches/newMatch", {
        players
      });

    } catch (error) {
      console.error("ADMIN MATCH FORM ERROR:", error);
      res.status(500).send("Unable to load match form.");
    }
  }
);// CREATE MATCH
app.post(
  "/admin/matches",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const {
      seriesName,
      teamA,
      teamB,
      teamAScore,
      teamBScore,
      matchDate,
      matchTime,
      status
    } = req.body;


    // =============================
    // DATE + TIME
    // =============================

    const date = new Date(`${matchDate}T${matchTime}`);

    if (isNaN(date.getTime())) {
      req.flash("error", "Please enter a valid match date and time.");
      return res.redirect("/admin/matches/new");
    }


    // =============================
    // PLAYER STATISTICS
    // =============================

    let players = [];

    if (req.body.players) {
      players = Array.isArray(req.body.players)
        ? req.body.players
        : Object.values(req.body.players);
    }

    // Remove empty player rows
    players = players.filter(player => {
      return player &&
        player.playerName &&
        player.playerName.trim() !== "";
    }); 

    for (const player of players) {

      // If hidden MongoDB ID is already present, keep it
      if (player.player && player.player.trim() !== "") {
        continue;
      }

      // Otherwise find the verified player using their IGN
      const verifiedPlayer = await Player.findOne({
        ign: player.playerName.trim(),
        verificationStatus: "verified"
      });

      if (!verifiedPlayer) {
        return res.status(400).send(
          `Player "${player.playerName}" is not a verified player.`
        );
      }

      player.player = verifiedPlayer._id.toString();
    }


    // =============================
    // VALIDATE PLAYERS
    // =============================

    const playerIds = players
      .map(player => player.player)
      .filter(Boolean);


    // Prevent duplicate players
    const uniquePlayerIds = new Set(playerIds);

    if (uniquePlayerIds.size !== playerIds.length) {
      req.flash(
        "error",
        "A player cannot be added more than once to the same match."
      );

      return res.redirect("/admin/matches/new");
    }


    // Make sure selected players actually exist
    if (playerIds.length > 0) {

      const existingPlayers = await Player.find({
        _id: { $in: playerIds },
        verificationStatus: "verified"
      });

      if (existingPlayers.length !== uniquePlayerIds.size) {

        req.flash(
          "error",
          "One or more selected players are invalid or not verified."
        );

        return res.redirect("/admin/matches/new");
      }

    }


    // =============================
    // PREPARE PLAYER DATA
    // =============================

    const playerStats = players.map(player => {

      const kills = Number(player.kills || 0);
      const deaths = Number(player.deaths || 0);
      const assists = Number(player.assists || 0);

      if (
        !Number.isInteger(kills) ||
        !Number.isInteger(deaths) ||
        !Number.isInteger(assists) ||
        kills < 0 ||
        deaths < 0 ||
        assists < 0
      ) {
        throw new ExpressError(
          400,
          "Kills, deaths and assists must be valid non-negative numbers."
        );
      }


      if (!["teamA", "teamB"].includes(player.team)) {
        throw new ExpressError(
          400,
          "Invalid team selected for a player."
        );
      }


      return {
        player: player.player,
        team: player.team,
        kills,
        deaths,
        assists,
        mvp: player.mvp === "true"
      };

    });


    // =============================
    // CREATE MATCH
    // =============================

    const match = new Match({

      seriesName,

      teamA,

      teamB,

      teamAScore: Number(teamAScore),

      teamBScore: Number(teamBScore),

      date,

      status,

      players: playerStats

    });


    await match.save();


    // =============================
    // SUCCESS
    // =============================

    req.flash(
      "success",
      "Match created successfully."
    );


    res.redirect(`/matches/${match._id}`);

  })
);

// SHOW EDIT MATCH FORM
app.get(
  "/admin/matches/:id/edit",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {
    const match = await Match.findById(req.params.id);

    if (!match) {
      throw new ExpressError(404, "Match Not Found");
    }

    const players = await Player.find({
      verificationStatus: "verified"
    }).sort({ ign: 1 });

    res.render("admin/matches/editMatch", {
      match,
      players
    });
  })
);

// UPDATE MATCH
app.put(
  "/admin/matches/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {
    const {
      seriesName,
      teamA,
      teamB,
      teamAScore,
      teamBScore,
      matchDate,
      matchTime,
      status
    } = req.body;

    const match = await Match.findById(req.params.id);

    if (!match) {
      throw new ExpressError(404, "Match Not Found");
    }

    // -----------------------------
    // Validate date and time
    // -----------------------------
    const date = new Date(`${matchDate}T${matchTime}`);

    if (isNaN(date.getTime())) {
      req.flash("error", "Please enter a valid match date and time.");
      return res.redirect(`/admin/matches/${match._id}/edit`);
    }

    // -----------------------------
    // Convert player form rows
    // -----------------------------
    let players = [];

    if (req.body.players) {
      players = Array.isArray(req.body.players)
        ? req.body.players
        : Object.values(req.body.players);
    }

    // Remove empty player rows
    players = players.filter(
      player => player && player.player
    );

    // -----------------------------
    // Check duplicate players
    // -----------------------------
    const playerIds = players.map(
      player => player.player
    );

    const uniquePlayerIds = new Set(playerIds);

    if (uniquePlayerIds.size !== playerIds.length) {
      req.flash(
        "error",
        "A player cannot be added more than once to the same match."
      );

      return res.redirect(`/admin/matches/${match._id}/edit`);
    }

    // -----------------------------
    // Validate selected players
    // -----------------------------
    // -----------------------------
    // Validate selected players
    // -----------------------------

    if (playerIds.length > 0) {

      const existingPlayers = await Player.find({
        _id: { $in: playerIds },
        verificationStatus: "verified"
      });

      if (existingPlayers.length !== uniquePlayerIds.size) {

        req.flash(
          "error",
          "One or more selected players are invalid or not verified."
        );

        return res.redirect(
          `/admin/matches/${match._id}/edit`
        );
      }
    }
    // -----------------------------
    // Build player statistics
    // -----------------------------
    const playerStats = players.map(player => {
      const kills = Number(player.kills || 0);
      const deaths = Number(player.deaths || 0);
      const assists = Number(player.assists || 0);

      if (
        !Number.isInteger(kills) ||
        !Number.isInteger(deaths) ||
        !Number.isInteger(assists) ||
        kills < 0 ||
        deaths < 0 ||
        assists < 0
      ) {
        throw new ExpressError(
          400,
          "Kills, deaths and assists must be valid non-negative numbers."
        );
      }

      if (!["teamA", "teamB"].includes(player.team)) {
        throw new ExpressError(
          400,
          "Invalid team selected for a player."
        );
      }

      return {
        player: player.player,
        team: player.team,
        kills,
        deaths,
        assists,
        mvp: player.mvp === "true"
      };
    });

    // -----------------------------
    // Update match
    // -----------------------------
    match.seriesName = seriesName;
    match.teamA = teamA;
    match.teamB = teamB;
    match.teamAScore = Number(teamAScore);
    match.teamBScore = Number(teamBScore);
    match.date = date;
    match.status = status;

    // Update player statistics
    match.players = playerStats;

    await match.save();

    req.flash("success", "Match updated successfully.");

    res.redirect(`/matches/${match._id}`);
  })
);
// DELETE MATCH
app.delete(
  "/admin/matches/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const match = await Match.findByIdAndDelete(req.params.id);

    if (!match) {
      throw new ExpressError(404, "Match Not Found");
    }

    req.flash("success", "Match deleted successfully.");

    res.redirect("/admin/matches");
  })
);
// ============================================================
// TOURNAMENT EVENT CMS
// ============================================================


// ============================================================
// CREATE TOURNAMENT EVENT PAGE
// ============================================================

app.get(
  "/admin/tournament-events/new",
  requireLogin,
  requireAdmin,
  (req, res) => {
    res.render("admin/events/newEvent");
  }
);


// ============================================================
// CREATE TOURNAMENT EVENT
// ============================================================

app.post(
  "/admin/tournament-events",
  requireLogin,
  requireAdmin,
  eventUpload.single("logo"),
  wrapAsync(async (req, res) => {

    if (!req.file) {
      req.flash("error", "Event logo is required.");
      return res.redirect("/admin/tournament-events/new");
    }

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      req.flash("error", "Please enter valid event dates.");
      return res.redirect("/admin/tournament-events/new");
    }

    if (endDate < startDate) {
      req.flash(
        "error",
        "Event end date cannot be before the start date."
      );

      return res.redirect("/admin/tournament-events/new");
    }

    const event = new Event({
      name: String(req.body.name || "").trim(),

      logo: "/uploads/events/" + req.file.filename,

      startDate,

      endDate,

      prizeAmount: Number(req.body.prizeAmount || 0),

      mode: String(req.body.mode || "").trim(),

      status: req.body.status || "upcoming"
    });

    await event.save();

    req.flash(
      "success",
      "Tournament event created successfully."
    );

    res.redirect(
      `/admin/tournament-events/${event._id}/manage`
    );
  })
);


// ============================================================
// ADMIN TOURNAMENT LIST
// ============================================================

app.get(
  "/admin/tournament-events",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const events = await Event.find({})
      .sort({ startDate: 1 });

    res.render("admin/events/index", {
      events
    });
  })
);

// ============================================================
// EDIT TOURNAMENT EVENT PAGE
// ============================================================

app.get(
  "/admin/tournament-events/:id/edit",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }

    res.render("admin/events/editEvent", {
      event
    });
  })
);


// ============================================================
// UPDATE TOURNAMENT EVENT
// ============================================================

app.put(
  "/admin/tournament-events/:id",
  requireLogin,
  requireAdmin,
  eventUpload.single("logo"),
  wrapAsync(async (req, res) => {

    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }

    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      req.flash(
        "error",
        "Please enter valid event dates."
      );

      return res.redirect(
        `/admin/tournament-events/${event._id}/edit`
      );
    }

    if (endDate < startDate) {
      req.flash(
        "error",
        "Event end date cannot be before the start date."
      );

      return res.redirect(
        `/admin/tournament-events/${event._id}/edit`
      );
    }

    const oldLogo = event.logo;

    event.name = String(req.body.name || "").trim();

    event.startDate = startDate;

    event.endDate = endDate;

    event.prizeAmount =
      Number(req.body.prizeAmount || 0);

    event.mode =
      String(req.body.mode || "").trim();

    event.status =
      req.body.status || "upcoming";


    // ----------------------------------------
    // Replace logo only if a new one was uploaded
    // ----------------------------------------

    if (req.file) {

      event.logo =
        "/uploads/events/" + req.file.filename;


      // Delete old logo
      if (oldLogo) {

        const oldLogoPath = path.join(
          import.meta.dirname,
          "public",
          oldLogo.replace(/^\/+/, "")
        );

        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
    }


    await event.save();

    req.flash(
      "success",
      "Tournament event updated successfully."
    );

    res.redirect(
      `/admin/tournament-events/${event._id}/manage`
    );
  })
);


// ============================================================
// DELETE TOURNAMENT EVENT
// ============================================================

app.delete(
  "/admin/tournament-events/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const event = await Event.findById(req.params.id);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    // ----------------------------------------
    // Delete all tournament data
    // ----------------------------------------

    await Promise.all([
      Qualifier.deleteMany({
        event: event._id
      }),

      TournamentGroup.deleteMany({
        event: event._id
      }),

      Standing.deleteMany({
        event: event._id
      }),

      Playoff.deleteMany({
        event: event._id
      })
    ]);


    // ----------------------------------------
    // Delete event logo
    // ----------------------------------------

    if (event.logo) {

      const logoPath = path.join(
        import.meta.dirname,
        "public",
        event.logo.replace(/^\/+/, "")
      );

      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }


    await Event.findByIdAndDelete(event._id);


    req.flash(
      "success",
      "Tournament event and all tournament data were deleted."
    );

    res.redirect("/admin/tournament-events");
  })
);


// ============================================================
// TOURNAMENT MANAGEMENT DASHBOARD
// ============================================================

app.get(
  "/admin/tournament-events/:eventId/manage",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    const [
      qualifiers,
      groups,
      standings,
      playoffs
    ] = await Promise.all([

      Qualifier.find({
        event: event._id
      }).sort({
        position: 1
      }),

      TournamentGroup.find({
        event: event._id
      }).sort({
        name: 1
      }),

      Standing.find({
        event: event._id
      })
        .populate("group")
        .sort({
          position: 1
        }),

      Playoff.find({
        event: event._id
      }).sort({
        round: 1,
        matchNumber: 1
      })

    ]);


    res.render(
      "admin/tournaments/show",
      {
        event,
        qualifiers,
        groups,
        standings,
        playoffs
      }
    );
  })
);


// ============================================================
// ADD QUALIFIER
// ============================================================

app.post(
  "/admin/tournament-events/:eventId/manage/qualifiers",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    const qualifier = new Qualifier({

      event: event._id,

      teamName:
        String(req.body.teamName || "").trim(),

      position:
        Number(req.body.position || 0),

      status:
        req.body.status || "pending"
    });


    await qualifier.save();


    req.flash(
      "success",
      "Qualifier added successfully."
    );

    res.redirect(
      `/admin/tournament-events/${eventId}/manage`
    );
  })
);


// ============================================================
// UPDATE QUALIFIER
// ============================================================

app.put(
  "/admin/tournament-events/:eventId/manage/qualifiers/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const qualifier = await Qualifier.findOne({
      _id: req.params.id,
      event: req.params.eventId
    });

    if (!qualifier) {
      throw new ExpressError(
        404,
        "Qualifier not found."
      );
    }


    qualifier.teamName =
      String(req.body.teamName || "").trim();

    qualifier.position =
      Number(req.body.position || 0);

    qualifier.status =
      req.body.status || "pending";


    await qualifier.save();


    req.flash(
      "success",
      "Qualifier updated successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// DELETE QUALIFIER
// ============================================================

app.delete(
  "/admin/tournament-events/:eventId/manage/qualifiers/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    await Qualifier.findOneAndDelete({
      _id: req.params.id,
      event: req.params.eventId
    });


    req.flash(
      "success",
      "Qualifier deleted successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// ADD GROUP
// ============================================================

app.post(
  "/admin/tournament-events/:eventId/manage/groups",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    const group = new TournamentGroup({

      event: event._id,

      name:
        String(req.body.name || "").trim()

    });


    await group.save();


    req.flash(
      "success",
      "Group created successfully."
    );

    res.redirect(
      `/admin/tournament-events/${eventId}/manage`
    );
  })
);


// ============================================================
// UPDATE GROUP
// ============================================================

app.put(
  "/admin/tournament-events/:eventId/manage/groups/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const group = await TournamentGroup.findOne({
      _id: req.params.id,
      event: req.params.eventId
    });

    if (!group) {
      throw new ExpressError(
        404,
        "Group not found."
      );
    }


    group.name =
      String(req.body.name || "").trim();


    await group.save();


    req.flash(
      "success",
      "Group updated successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// DELETE GROUP
// ============================================================

app.delete(
  "/admin/tournament-events/:eventId/manage/groups/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const groupId = req.params.id;

    const group = await TournamentGroup.findOne({
      _id: groupId,
      event: req.params.eventId
    });

    if (!group) {
      throw new ExpressError(
        404,
        "Group not found."
      );
    }


    // Delete standings belonging to this group
    await Standing.deleteMany({
      group: group._id,
      event: req.params.eventId
    });


    await group.deleteOne();


    req.flash(
      "success",
      "Group and its standings were deleted."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// ADD STANDING
// ============================================================

app.post(
  "/admin/tournament-events/:eventId/manage/standings",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    let group = null;


    if (req.body.group) {

      group = await TournamentGroup.findOne({
        _id: req.body.group,
        event: event._id
      });

      if (!group) {
        throw new ExpressError(
          400,
          "Invalid tournament group."
        );
      }
    }


    const standing = new Standing({

      event: event._id,

      group: group
        ? group._id
        : null,

      teamName:
        String(req.body.teamName || "").trim(),

      position:
        Number(req.body.position || 1),

      played:
        Number(req.body.played || 0),

      wins:
        Number(req.body.wins || 0),

      losses:
        Number(req.body.losses || 0),

      draws:
        Number(req.body.draws || 0),

      points:
        Number(req.body.points || 0)

    });


    await standing.save();


    req.flash(
      "success",
      "Standing added successfully."
    );

    res.redirect(
      `/admin/tournament-events/${eventId}/manage`
    );
  })
);


// ============================================================
// UPDATE STANDING
// ============================================================

app.put(
  "/admin/tournament-events/:eventId/manage/standings/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const standing = await Standing.findOne({
      _id: req.params.id,
      event: req.params.eventId
    });

    if (!standing) {
      throw new ExpressError(
        404,
        "Standing not found."
      );
    }


    let group = null;


    if (req.body.group) {

      group = await TournamentGroup.findOne({
        _id: req.body.group,
        event: req.params.eventId
      });

      if (!group) {
        throw new ExpressError(
          400,
          "Invalid tournament group."
        );
      }
    }


    standing.group =
      group ? group._id : null;

    standing.teamName =
      String(req.body.teamName || "").trim();

    standing.position =
      Number(req.body.position || 1);

    standing.played =
      Number(req.body.played || 0);

    standing.wins =
      Number(req.body.wins || 0);

    standing.losses =
      Number(req.body.losses || 0);

    standing.draws =
      Number(req.body.draws || 0);

    standing.points =
      Number(req.body.points || 0);


    await standing.save();


    req.flash(
      "success",
      "Standing updated successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// DELETE STANDING
// ============================================================

app.delete(
  "/admin/tournament-events/:eventId/manage/standings/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    await Standing.findOneAndDelete({
      _id: req.params.id,
      event: req.params.eventId
    });


    req.flash(
      "success",
      "Standing deleted successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// ADD PLAYOFF MATCH
// ============================================================

app.post(
  "/admin/tournament-events/:eventId/manage/playoffs",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) {
      throw new ExpressError(
        404,
        "Tournament event not found."
      );
    }


    const playoff = new Playoff({

      event: event._id,

      round:
        String(req.body.round || "").trim(),

      matchNumber:
        Number(req.body.matchNumber || 1),

      teamA:
        String(req.body.teamA || "").trim(),

      teamB:
        String(req.body.teamB || "").trim(),

      scoreA:
        Number(req.body.scoreA || 0),

      scoreB:
        Number(req.body.scoreB || 0),

      winner:
        String(req.body.winner || "").trim()

    });


    await playoff.save();


    req.flash(
      "success",
      "Playoff match added successfully."
    );

    res.redirect(
      `/admin/tournament-events/${eventId}/manage`
    );
  })
);


// ============================================================
// UPDATE PLAYOFF
// ============================================================

app.put(
  "/admin/tournament-events/:eventId/manage/playoffs/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const playoff = await Playoff.findOne({
      _id: req.params.id,
      event: req.params.eventId
    });

    if (!playoff) {
      throw new ExpressError(
        404,
        "Playoff match not found."
      );
    }


    playoff.round =
      String(req.body.round || "").trim();

    playoff.matchNumber =
      Number(req.body.matchNumber || 1);

    playoff.teamA =
      String(req.body.teamA || "").trim();

    playoff.teamB =
      String(req.body.teamB || "").trim();

    playoff.scoreA =
      Number(req.body.scoreA || 0);

    playoff.scoreB =
      Number(req.body.scoreB || 0);

    playoff.winner =
      String(req.body.winner || "").trim();


    await playoff.save();


    req.flash(
      "success",
      "Playoff match updated successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// DELETE PLAYOFF
// ============================================================

app.delete(
  "/admin/tournament-events/:eventId/manage/playoffs/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    await Playoff.findOneAndDelete({
      _id: req.params.id,
      event: req.params.eventId
    });


    req.flash(
      "success",
      "Playoff match deleted successfully."
    );

    res.redirect(
      `/admin/tournament-events/${req.params.eventId}/manage`
    );
  })
);


// ============================================================
// PUBLIC TOURNAMENT LIST
// ============================================================

app.get(
  "/tournament-events",
  wrapAsync(async (req, res) => {

    const events = await Event.find({})
      .sort({
        startDate: 1
      });

    res.render(
      "tournament-events/index",
      {
        events
      }
    );
  })
);


// ============================================================
// PUBLIC SINGLE TOURNAMENT
// ============================================================

app.get(
  "/tournament-events/:id",
  wrapAsync(async (req, res) => {

    const event = await Event.findById(
      req.params.id
    );

    if (!event) {
      return res
        .status(404)
        .send("Event not found.");
    }


    const [
      qualifiers,
      groups,
      standings,
      playoffs
    ] = await Promise.all([

      Qualifier.find({
        event: event._id
      }).sort({
        position: 1
      }),

      TournamentGroup.find({
        event: event._id
      }).sort({
        name: 1
      }),

      Standing.find({
        event: event._id
      })
        .populate("group")
        .sort({
          position: 1
        }),

      Playoff.find({
        event: event._id
      }).sort({
        round: 1,
        matchNumber: 1
      })

    ]);


    res.render(
      "tournament-events/showEvent",
      {
        event,
        qualifiers,
        groups,
        standings,
        playoffs
      }
    );
  })
);

// ============================================================
// ADMIN COMMAND CENTER
// ============================================================
// ============================================================
// ADMIN COMMAND CENTER
// ============================================================

app.get(
  "/admin",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const [
      playerCount,
      matchCount,
      sliderCount,
      eventCount,
      teamCount,
      pendingPlayerCount
    ] = await Promise.all([

      Player.countDocuments(),

      Match.countDocuments(),

      Slider.countDocuments(),

      Event.countDocuments(),

      Team.countDocuments(),

      Player.countDocuments({
        verificationStatus: "pending"
      })

    ]);


    const [
      activeSliderCount,
      ongoingMatchCount,
      upcomingMatchCount
    ] = await Promise.all([

      Slider.countDocuments({
        active: true
      }),

      Match.countDocuments({
        status: "ongoing"
      }),

      Match.countDocuments({
        status: "upcoming"
      })

    ]);


    res.render("admin/dashboard", {

      stats: {

        players: playerCount,

        matches: matchCount,

        sliders: sliderCount,

        events: eventCount,

        teams: teamCount,

        activeSliders: activeSliderCount,

        ongoingMatches: ongoingMatchCount,

        upcomingMatches: upcomingMatchCount,

        pendingPlayers: pendingPlayerCount

      }

    });

  })
);
// ============================================================
// ADMIN PLAYER VERIFICATION CENTER
// ============================================================

// PLAYER VERIFICATION LIST
app.get(
  "/admin/players",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const {
      search = "",
      verificationStatus = ""
    } = req.query;

    const filter = {};

    if (search.trim()) {
      const searchText = search.trim();

      filter.$or = [
        {
          ign: {
            $regex: searchText,
            $options: "i"
          }
        },
        {
          uid: {
            $regex: searchText,
            $options: "i"
          }
        },
        {
          name: {
            $regex: searchText,
            $options: "i"
          }
        }
      ];
    }

    if (
      ["pending", "verified", "unverified"].includes(
        verificationStatus
      )
    ) {
      filter.verificationStatus = verificationStatus;
    }

    const players = await Player
      .find(filter)
      .sort({
        verificationStatus: 1,
        createdAt: -1
      })
      .lean();

    const counts = {
      pending: await Player.countDocuments({
        verificationStatus: "pending"
      }),

      verified: await Player.countDocuments({
        verificationStatus: "verified"
      }),

      unverified: await Player.countDocuments({
        verificationStatus: "unverified"
      })
    };

    res.render("admin/players/index", {
      players,
      counts,
      filters: {
        search,
        verificationStatus
      }
    });
  })
);


// PLAYER VERIFICATION DETAILS
app.get(
  "/admin/players/:id",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const player = await Player
      .findById(req.params.id)
      .populate("owner", "username email");

    if (!player) {
      throw new ExpressError(
        404,
        "Player Not Found"
      );
    }

    res.render("admin/players/show", {
      player
    });
  })
);


// CHANGE VERIFICATION STATUS
app.put(
  "/admin/players/:id/verification",
  requireLogin,
  requireAdmin,
  wrapAsync(async (req, res) => {

    const {
      verificationStatus
    } = req.body;

    if (
      !["pending", "verified", "unverified"]
        .includes(verificationStatus)
    ) {
      throw new ExpressError(
        400,
        "Invalid verification status."
      );
    }

    const player = await Player.findById(
      req.params.id
    );

    if (!player) {
      throw new ExpressError(
        404,
        "Player Not Found"
      );
    }

    player.verificationStatus =
      verificationStatus;

    await player.save();

    req.flash(
      "success",
      `Player verification status changed to ${verificationStatus}.`
    );

    res.redirect(
      `/admin/players/${player._id}`
    );
  })
);
// verification screenshot review route admin
app.get("/admin/players/:id/screenshot", requireAdmin, wrapAsync(async (req, res) => {
  const player = await Player.findById(req.params.id);

  if (!player) {
    throw new ExpressError(404, "Player Not Found");
  }

  if (!player.verificationScreenshot) {
    throw new ExpressError(404, "Verification Screenshot Not Found");
  }

  const filename = path.basename(
    player.verificationScreenshot.replace(/\\/g, "/")
  );

  const screenshotPath = path.join(
    import.meta.dirname,
    "public",
    "uploads",
    "players",
    filename
  );

  if (!fs.existsSync(screenshotPath)) {
    throw new ExpressError(404, "Verification Screenshot File Not Found");
  }

  res.sendFile(screenshotPath);
}));

app.all(/.*/, (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
  const backUrl = req.get("Referrer") || "/";

  res.status(err.statusCode || 500).render("error", {
    err,
    message: err.message || "Something went wrong",
    backUrl
  });
});
app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
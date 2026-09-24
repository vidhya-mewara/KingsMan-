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

app.use((req, res, next) => {
  res.locals.currentPage = req.path;
  next();
});

app.get("/players", async (req, res, next) => {

  try {

    const {
      search,
      country,
      region,
      role,
      verificationStatus,
      inTeam
    } = req.query;


    // ==========================================
    // BUILD FILTER
    // ==========================================

    const filter = {};


    // ==========================================
    // SEARCH IGN / UID
    // ==========================================

    if (search && search.trim() !== "") {

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
        }
      ];
    }


    // ==========================================
    // COUNTRY
    // ==========================================

    if (country) {
      filter.country = country;
    }


    // ==========================================
    // REGION
    // ==========================================

    if (region) {
      filter.region = region;
    }


    // ==========================================
    // ROLE
    // ==========================================

    if (role) {
      filter.role = role;
    }


    // ==========================================
    // VERIFICATION
    // ==========================================

    if (verificationStatus) {
      filter.verificationStatus =
        verificationStatus;
    }


    // ==========================================
    // TEAM STATUS
    // ==========================================

    if (inTeam === "true") {

      filter.inTeam = true;

    } else if (inTeam === "false") {

      filter.inTeam = false;

    }


    // ==========================================
    // GET PLAYERS
    // ==========================================

    const players = await Player
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();


    // ==========================================
    // SEND TO EJS
    // ==========================================

    res.render("players", {

      players,

      filters: {
        search: search || "",
        country: country || "",
        region: region || "",
        role: role || "",
        verificationStatus:
          verificationStatus || "",
        inTeam: inTeam || ""
      }

    });

  } catch (error) {

    next(error);

  }

});

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

      verificationScreenshot: req.file.path,

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

  res.redirect("/players");
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

  res.redirect("/players");
}));

app.get("/logout", (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      return res.redirect("/players");
    }

    res.redirect("/players");
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

    console.log("SLIDERS:", sliders);
    console.log("PROMOTION:", promotion);
    console.log("ONGOING MATCHES:", ongoingMatches);
    console.log("UPCOMING MATCHES:", upcomingMatches);
    console.log("PAST MATCHES:", pastMatches);

    res.render("home", {
      sliders,
      promotion,
      ongoingMatches,
      upcomingMatches,
      pastMatches
    });

  } catch (error) {
    console.error("HOME ERROR:", error);
    res.status(500).send("Home Page Error");
  }
});
app.get("/admin/sliders", async (req, res) => {
  try {

    const sliders = await Slider.find().sort({
      position: 1
    });

    res.render("admin/sliders", {
      sliders
    });

  } catch (error) {

    console.error("ADMIN SLIDERS ERROR:", error);

    res.status(500).send("Unable to load sliders.");

  }
});
app.post(
  "/admin/sliders",
  sliderUpload.single("image"),
  async (req, res) => {

    try {
      
      console.log("FORM DATA:", req.body);
      console.log("UPLOADED FILE:", req.file);

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

      console.log("SLIDER SAVED:", slider);

      res.redirect("/admin/sliders");

    } catch (error) {

      console.error("SLIDER SAVE ERROR:", error);

      res.status(500).send("Slider upload failed.");

    }

  }
);
// EDIT SLIDER PAGE

app.get("/admin/sliders/:id/edit", async (req, res) => {

  try {

    const slider = await Slider.findById(req.params.id);

    if (!slider) {
      return res.status(404).send("Slider not found.");
    }

    res.render("admin/edit-slider", {
      slider
    });

  } catch (error) {

    console.error("EDIT SLIDER ERROR:", error);

    res.status(500).send("Unable to load slider.");

  }

});
// UPDATE SLIDER
// UPDATE SLIDER

app.put(
  "/admin/sliders/:id",
  sliderUpload.single("image"),
  async (req, res) => {

    try {

      const slider = await Slider.findById(req.params.id);

      if (!slider) {
        return res.status(404).send("Slider not found.");
      }

      // Keep the old image path before changing it
      const oldImage = slider.image;

      // Update text/content fields
      slider.title = req.body.title;
      slider.description = req.body.description || "";

      slider.eventDate = req.body.eventDate || "";
      slider.eventLocation = req.body.eventLocation || "";
      slider.eventDescription = req.body.eventDescription || "";
      slider.eventLink = req.body.eventLink || "";

      slider.buttonText = req.body.buttonText || "";
      slider.buttonLink = req.body.buttonLink || "";

      slider.position = Number(req.body.position) || 0;

      // Checkbox handling
      slider.active = req.body.active === "true";

      // If a new image was uploaded
      if (req.file) {

        // Save new image path
        slider.image =
          "/uploads/sliders/" + req.file.filename;

        // Delete old image from disk
        if (oldImage) {

          const oldImagePath =
            "public" + oldImage;

          if (fs.existsSync(oldImagePath)) {

            fs.unlinkSync(oldImagePath);

            console.log(
              "OLD SLIDER IMAGE DELETED:",
              oldImagePath
            );

          }

        }

      }

      await slider.save();

      console.log("SLIDER UPDATED:", slider);

      res.redirect("/admin/sliders");

    } catch (error) {

      console.error("SLIDER UPDATE ERROR:", error);

      res.status(500).send("Unable to update slider.");

    }

  }
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
    if (playerIds.length > 0) {
      const existingPlayers = await Player.find({
        _id: { $in: playerIds }
      });

      if (existingPlayers.length !== uniquePlayerIds.size) {
        req.flash(
          "error",
          "One or more selected players are invalid."
        );

        return res.redirect(`/admin/matches/${match._id}/edit`);
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

    res.redirect("/");
  })
);
// ===============================
// ADD TOURNAMENT EVENT PAGE
// ===============================

app.get(
  "/admin/tournament-events/new",
  requireLogin,
  requireAdmin,
  (req, res) => {
    res.render("admin/events/newEvent");
  }
);


// ===============================
// CREATE TOURNAMENT EVENT
// ===============================

app.post(
  "/admin/tournament-events",
  requireLogin,
  requireAdmin,
  eventUpload.single("logo"),
  wrapAsync(async (req, res) => {

    // Check image
    if (!req.file) {
      req.flash("error", "Event logo is required.");
      return res.redirect("/admin/tournament-events/new");
    }

    // Validate dates
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      req.flash("error", "Please enter valid event dates.");
      return res.redirect("/admin/tournament-events/new");
    }

    // End date cannot be before start date
    if (endDate < startDate) {
      req.flash(
        "error",
        "Event end date cannot be before the start date."
      );

      return res.redirect("/admin/tournament-events/new");
    }

    // Create event
    const event = new Event({
      name: req.body.name,

      logo: "/uploads/events/" + req.file.filename,

      startDate,

      endDate,

      prizeAmount: Number(req.body.prizeAmount || 0),

      mode: req.body.mode,

      status: req.body.status || "upcoming"
    });

    await event.save();

    console.log("TOURNAMENT EVENT SAVED:", event);

    req.flash(
      "success",
      "Event created successfully."
    );

    // Go to public tournament page
    res.redirect("/tournament-events");
  })
);


// ===============================
// ADMIN TOURNAMENT EVENTS
// ===============================

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


// ===============================
// PUBLIC TOURNAMENT EVENTS
// ===============================

app.get(
  "/tournament-events",
  wrapAsync(async (req, res) => {

    const events = await Event.find({})
      .sort({ startDate: 1 });

    res.render("tournament-events/index", {
      events
    });
  })
);


// ===============================
// PUBLIC SINGLE TOURNAMENT
// ===============================

app.get(
  "/tournament-events/:id",
  wrapAsync(async (req, res) => {

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).send("Event not found.");
    }

    res.render("tournament-events/showEvent", {
      event
    });
  })
);


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
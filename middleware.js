import User from "./model/userSchema.js";
import Player from "./model/playerProfile.js";
import ExpressError from "./utils/expressErrors.js";

/*
|--------------------------------------------------------------------------
| Check if user is logged in
|--------------------------------------------------------------------------
*/
export const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        req.session.redirectUrl = req.originalUrl;

        req.flash("error", "You must be logged in to continue.");

        return res.redirect("/login")
    }

    next();
};


/*
|--------------------------------------------------------------------------
| Save redirect URL
|--------------------------------------------------------------------------
*/
export const saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }

    next();
};


/*
|--------------------------------------------------------------------------
| Load current user
|--------------------------------------------------------------------------
| Makes the logged-in user available as:
|
| req.user
| res.locals.currUser
|
*/
export const loadUser = async (req, res, next) => {
    try {
        res.locals.currUser = null;
        req.user = null;

        if (req.session.userId) {
            const user = await User.findById(req.session.userId);

            if (user) {
                req.user = user;
                res.locals.currUser = user;
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};


/*
|--------------------------------------------------------------------------
| Check if user owns the player profile
|--------------------------------------------------------------------------
*/
export const isPlayerOwner = async (req, res, next) => {
    const { id } = req.params;

    const user = await User.findById(req.session.userId);

    if (!user) {
        req.flash("error", "User account not found.");
        return res.redirect("/login");
    }

    const player = await Player.findById(id);

    if (!player) {
        throw new ExpressError(404, "Player Not Found");
    }

    /*
    | User.player contains the Player _id
    */
    if (
        !user.player ||
        user.player.toString() !== player._id.toString()
    ) {
        req.flash(
            "error",
            "You are not allowed to modify this player profile."
        );

        return res.redirect(`/players/${id}`);
    }

    next();
};


/*
|--------------------------------------------------------------------------
| Check if user already has a player profile
|--------------------------------------------------------------------------
*/
export const hasNoPlayer = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            req.flash("error", "User account not found.");
            return res.redirect("/login");
        }

        // If user has no player reference, allow creation
        if (!user.player) {
            return next();
        }

        // Check whether the referenced player actually exists
        const player = await Player.findById(user.player);

        if (!player) {
            // Old/deleted player reference — repair it
            user.player = null;
            await user.save();

            return next();
        }

        // Player actually exists
        req.flash(
            "error",
            "You already have a player profile."
        );

        return res.redirect(`/players/${player._id}`);

    } catch (error) {
        next(error);
    }
};


/*
|--------------------------------------------------------------------------
| Validate user input
|--------------------------------------------------------------------------
*/
export const validateUser = (req, res, next) => {
    next();
};
/*
|--------------------------------------------------------------------------
| Check if logged-in user is admin
|--------------------------------------------------------------------------
*/
export const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            req.session.redirectUrl = req.originalUrl;

            req.flash("error", "You must be logged in to continue.");

            return res.redirect("/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            req.flash("error", "User account not found.");
            return res.redirect("/login");
        }

        if (user.role !== "admin") {
            req.flash("error", "You do not have permission to access this page.");
            return res.redirect("/");
        }

        req.user = user;
        res.locals.currUser = user;

        next();

    } catch (error) {
        next(error);
    }
};
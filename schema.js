import Joi from "joi";

export const playerSchema = Joi.object({
        name: Joi.string()
            .trim()
            .max(50)
            .required(),

        uid: Joi.string()
            .trim()
            .required(),

        ign: Joi.string()
            .trim()
            .max(30)
            .required(),

        role: Joi.array()
            .items(
                Joi.string().valid(
                    "Duelist",
                    "Initiator",
                    "Controller",
                    "Sentinel",
                    "Flex"
                )
            )
            .min(1)
            .required(),

        agents: Joi.array()
            .items(
                Joi.string().valid(
                    "Jett",
                    "Raze",
                    "Neon",
                    "Yoru",
                    "Iso",
                    "Phoenix",
                    "Reyna",
                    "Waylay",
                    "Sova",
                    "Fade",
                    "Breach",
                    "K/O",
                    "Tejo",
                    "Gekko",
                    "Skye",
                    "Brimstone",
                    "Omen",
                    "Harbour",
                    "Astra",
                    "Viper",
                    "Clove",
                    "Cypher",
                    "Killjoy",
                    "Chamber",
                    "Vyse",
                    "Deadlock",
                    "Sage"
                )
            )
            .min(1)
            .required(),
    country: Joi.string().trim().required(),

    region: Joi.string().trim().required(),
    inTeam: Joi.boolean()
        .required(),

    teamName: Joi.string()
        .trim()
        .max(50)
        .allow("")
        .when("inTeam", {
            is: true,
            then: Joi.required(),
            otherwise: Joi.allow("")
        }),


        verificationScreenshot: Joi.string()
            .required(),

        verificationStatus: Joi.string()
            .valid("pending", "verified", "unverified")
            .default("pending")
            ,
    socialMedia: Joi.object({
        instagram: Joi.string().trim().allow(""),
        facebook: Joi.string().trim().allow(""),
        youtube: Joi.string().trim().allow(""),
        twitch: Joi.string().trim().allow(""),
        kick: Joi.string().trim().allow("")
    })
    });


export const userSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required(),

    email: Joi.string()
        .trim()
        .lowercase()
        .email()
        .required(),

    password: Joi.string()
        .min(8)
        .required(),
});




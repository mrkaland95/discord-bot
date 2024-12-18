import { UsersDB } from "../../../db/schema";
import { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { viewWhitelistedIDsButton } from "../utils/command-utils";
import {incorrectSteamIDFormatResponse, logToDiscord, steamID64Regex} from "../../../utils/utils";
import env from "../../../load-env";
import { refreshUsersCache, retrieveDiscordUser } from "../../../cache";


export default {
    data: new SlashCommandSubcommandBuilder()
    .setName('add')
    .setDescription(`Adds a steamID to a users whitelist slots`)
    .addStringOption(option =>
        option
            .setName('steamid')
            .setDescription('The steam64ID to add')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Optional name to describe the user you added')
    ),


    async execute(interaction: ChatInputCommandInteraction) {
        const steamID = interaction.options.getString('steamid')
        const name = interaction.options.getString('name')

        if (!steamID) {
            return await interaction.followUp({
                content: `Please input a value for SteamID.`,
            })
        }

        const user = await retrieveDiscordUser(interaction.user)

        // If we were unable to retrieve a user even after refreshing the cache and querying the database,
        // Some deeper problem must have occurred.

        if (!user) {
            await interaction.followUp({
                content: `Internal server error occurred`
            })
            // This is meant to be equivalent to an assert, i.e a logic/programmer error that needs to be fixed if it occurs.
            // We must have initialized a user at this point.
            throw Error(`User not yet initialized in DB by the time data was attempted to be changed. A user must be initialized in the CB beforehand.`)
        }

        if (user.Whitelist64IDs.length >= Number(env.MAX_WHITELIST_SLOTS)) {
            return await interaction.followUp({
                content: `You have hit your limit of whitelisted steamIDs(${user.Whitelist64IDs.length}/${env.MAX_WHITELIST_SLOTS}). Please remove some before attempting to add new ones.`
            })
        }

        if (!steamID64Regex.test(steamID)) {
            return await incorrectSteamIDFormatResponse(interaction, steamID)
        }

        const steamIDs = user.Whitelist64IDs
        const exists = steamIDs.some(item => item.steamID === steamID)

        if (exists) {
            return await interaction.followUp({
                content: `❌ The SteamID \`${steamID}\` is already among your whitelisted IDs.`,
                ephemeral: true
            });
        }

        if (name) {
            steamIDs.push({steamID: steamID, name: name})
        } else {
            steamIDs.push({steamID: steamID})
        }

        const newUser = await UsersDB.findOneAndUpdate({ DiscordID: user.DiscordID }, {
            Whitelist64IDs: steamIDs,
        })

        if (newUser) {
            const name = interaction.user.globalName ? interaction.user.globalName : interaction.user.tag

            const msg = `User ${name} added a steamID to their whitelist \n`+
                `SteamID:  \`${steamID}\`\n`

            await logToDiscord(msg)
        }

        // Updated the state of the database, so the cache must also be updated.
        await refreshUsersCache()

        return interaction.followUp({
            content: `Succesfully added steamID: \`${steamID}\`\n`+
            `NOTE: This bot does not know whether the SteamID exists, just that it's correctly formatted.`,
            ephemeral: true,
            components: [viewWhitelistedIDsButton]
        })

    }
}



import { Client, Collection, Events, GatewayIntentBits, ClientOptions } from "discord.js";
import 'dotenv/config';
import { loadSlashCommands} from './utils/utils.js'
import { glob } from "glob";
import CustomClient from "./types/custom-client";
import mongoose from "mongoose";
import env from "./load-env";


/*

Discord

Resources:

https://discordjs.guide/#before-you-begin
https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands


*/

mongoose.connect(env.MONGO_DB_URI)

mongoose.connection.once('open', async function() {
	console.log(`MongoDB/Mongoose connection established successfully.`)
})


async function main() {
	const rootDir = __dirname
	const commandFiles = await glob(`${rootDir}/commands/*/*{.ts,.js}`, { windowsPathsNoEscape: true })
	const commands = await loadSlashCommands(commandFiles)

	const token = env.DISCORD_APP_TOKEN

	const client = new CustomClient({intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	]});

	client.commands = commands

	client.on(Events.InteractionCreate, async interaction => {
		if (!interaction.isChatInputCommand()) return;

		const command = client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.log(`There was an error while executing command: ${interaction.commandName}`)
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
		}


	})

	client.once(Events.ClientReady, readyClient => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	});

	await client.login(token);
}



main()
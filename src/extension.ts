import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const EXTENSION = 'command-palette';

interface CommandSettingEntry {
	command: string;
	title: string;
	category?: string;
	when?: string;
	args?: any[];
}

interface Command {
	command: string;
	title: string;
	category?: string;
}
interface CommandPaletteItem {
	command: string;
	when: string;
}

interface CommandToRegister {
	command: string;
	originalCommand: string;
	args: any[];
}

function customId(command: string): string {
	return `${EXTENSION}.${command}`;
}
function toCustomCommand(command: CommandSettingEntry): Command {
	return {
		command: customId(command.command),
		title: command.title,
		category: command.category
	};
}
function toCommandPaletteItem(command: CommandSettingEntry): CommandPaletteItem {
	return {
		command: customId(command.command),
		when: command.when ?? 'true'
	};
}
function toCommandToRegister(command: CommandSettingEntry): CommandToRegister {
	return {
		command: customId(command.command),
		originalCommand: command.command,
		args: command.args ?? []
	};
}

async function updateCustomCommands(context: vscode.ExtensionContext): Promise<CommandToRegister[]> {

	const customCommandsSetting = vscode.workspace.getConfiguration(EXTENSION).get<CommandSettingEntry[]>('commands', []);

	const customCommandsFromSettings = customCommandsSetting.map(toCustomCommand);
	const commandPaletteItemsFromSettings = customCommandsSetting.map(toCommandPaletteItem);

	const file = context.extension.packageJSON
	const currentCustomCommands: Command[] = file.contributes.commands;
	const currentCommandPaletteItems: CommandPaletteItem[] = file.contributes.menus.commandPalette;

	let anyChanges = false;
	anyChanges ||= currentCustomCommands.length !== customCommandsFromSettings.length;
	anyChanges ||= currentCommandPaletteItems.length !== commandPaletteItemsFromSettings.length;
	if (!anyChanges) {
		const customCommandsFromSettingsSorted = customCommandsFromSettings.sort((a, b) => a.command.localeCompare(b.command));
		const currentCustomCommandsSorted = currentCustomCommands.sort((a, b) => a.command.localeCompare(b.command));
		for (let i = 0; i < currentCustomCommandsSorted.length && !anyChanges; i++) {
			if (
				currentCustomCommandsSorted[i].command !== customCommandsFromSettingsSorted[i].command
				|| currentCustomCommandsSorted[i].title !== customCommandsFromSettingsSorted[i].title
				|| currentCustomCommandsSorted[i].category !== customCommandsFromSettingsSorted[i].category) {
				anyChanges = true;
				break;
			}
		}

		const commandPaletteItemsFromSettingsSorted = commandPaletteItemsFromSettings.sort((a, b) => a.command.localeCompare(b.command));
		const currentCommandPaletteItemsSorted = currentCommandPaletteItems.sort((a, b) => a.command.localeCompare(b.command));
		for (let i = 0; i < currentCommandPaletteItemsSorted.length && !anyChanges; i++) {
			if (
				currentCommandPaletteItemsSorted[i].command !== commandPaletteItemsFromSettingsSorted[i].command
				|| currentCommandPaletteItemsSorted[i].when !== commandPaletteItemsFromSettingsSorted[i].when) {
				anyChanges = true;
				break;
			}
		}
	}

	if (anyChanges) {
		file.contributes.commands = customCommandsFromSettings;
		file.contributes.menus.commandPalette = commandPaletteItemsFromSettings;
		const fileName = context.extensionPath + '/package.json';
		await fs.writeFile(fileName, JSON.stringify(file, undefined, 4).concat('\n'));
		const selection = await vscode.window.showInformationMessage('Command-palette (extension) have been updated. Please restart VS Code.', 'Restart VS Code');
		if (selection === 'Restart VS Code') {
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	}
	return customCommandsSetting.map(toCommandToRegister);
}

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(EXTENSION)) {
				updateCustomCommands(context);
			}
		})
	);

	const commands = await updateCustomCommands(context);
	for (const command of commands) {
		context.subscriptions.push(
			vscode.commands.registerCommand(command.command, async () => {
				await vscode.commands.executeCommand(command.originalCommand, ...command.args);
			})
		);
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
const deepEqual = require('deep-equal');

import { v4 as uuid } from 'uuid';
import { CommandSettingEntry, EXTENSION, getConfiguration } from './config';

const removeUndefined = (obj: any) => Object.keys(obj).reduce((acc, key) => obj[key] === undefined ? acc : { ...acc, [key]: obj[key] }, {});

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
function workspaceContextKey(): string {
	return `${EXTENSION}.workspaceId`;
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
		when: command.when ?? 'true',
	};
}
function toWorkspaceCommandPaletteItem(command: CommandSettingEntry, workspaceId: string): CommandPaletteItem {
	return {
		command: customId(command.command),
		when: `${workspaceContextKey()} == ${workspaceId} && ` + (command.when ?? 'true'),
	};
}
function toCommandToRegister(command: CommandSettingEntry): CommandToRegister {
	return {
		command: customId(command.command),
		originalCommand: command.command,
		args: command.args ?? [],
	};
}

async function updateCustomCommands(
	context: vscode.ExtensionContext,
	workspaceId: string,
): Promise<CommandToRegister[]> {

	// global commands
	const customCommandsSetting = getConfiguration('commands') ?? [];
	const customCommandsFromSettings = customCommandsSetting.map(toCustomCommand);
	const commandPaletteItemsFromSettings = customCommandsSetting.map(toCommandPaletteItem);

	// workspace commands
	const customWorkspaceCommandsSetting = getConfiguration('workspaceCommands') ?? [];
	const customWorkspaceCommandsFromSettings = customWorkspaceCommandsSetting.map(toCustomCommand);
	const workspaceCommandPaletteItemsFromSettings = customWorkspaceCommandsSetting.map(c => toWorkspaceCommandPaletteItem(c, workspaceId));

	// current commands
	const packageJSON = context.extension.packageJSON
	const currentCustomCommands: Command[] = packageJSON.contributes.commands.map(removeUndefined);
	const currentCommandPaletteItems: CommandPaletteItem[] = packageJSON.contributes.menus.commandPalette.map(removeUndefined);

	// copy commands from other workspaces, as we don't want to overwrite them
	for (let i = 0; i < currentCustomCommands.length; i++) {
		const command = currentCustomCommands[i];
		const commandPaletteItem = currentCommandPaletteItems[i];
		if (commandPaletteItem.when.includes(workspaceContextKey()) && !commandPaletteItem.when.includes(workspaceId)) {
			customCommandsFromSettings.push(command);
			commandPaletteItemsFromSettings.push(commandPaletteItem);
		}
	}

	// combine commands
	const customCommands = [...customCommandsFromSettings, ...customWorkspaceCommandsFromSettings].map(removeUndefined);
	const commandPaletteItems = [...commandPaletteItemsFromSettings, ...workspaceCommandPaletteItemsFromSettings].map(removeUndefined);

	let anyChanges = false;
	anyChanges ||= !deepEqual(customCommands, currentCustomCommands);
	anyChanges ||= !deepEqual(commandPaletteItems, currentCommandPaletteItems);

	if (anyChanges) {
		packageJSON.contributes.commands = customCommands;
		packageJSON.contributes.menus.commandPalette = commandPaletteItems;
		const fileName = context.extensionPath + '/package.json';
		await fs.writeFile(fileName, JSON.stringify(packageJSON, undefined, 4).concat('\n'));
		const selection = await vscode.window.showInformationMessage('Command-palette (extension) have been updated. Please restart VS Code.', 'Restart VS Code');
		if (selection === 'Restart VS Code') {
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	}
	
	return [...customCommandsSetting, ...customWorkspaceCommandsSetting].map(toCommandToRegister);
}

export async function activate(context: vscode.ExtensionContext) {
	let maybeWorkspaceId = context.workspaceState.get<string>('workspaceId');
	if (!maybeWorkspaceId) {
		maybeWorkspaceId = uuid();
		await context.workspaceState.update('workspaceId', maybeWorkspaceId);
	}
	const workspaceId = maybeWorkspaceId;
	await vscode.commands.executeCommand('setContext', workspaceContextKey(), workspaceId);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(EXTENSION)) {
				updateCustomCommands(context, workspaceId);
			}
		})
	);

	const commands = await updateCustomCommands(context, workspaceId);
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

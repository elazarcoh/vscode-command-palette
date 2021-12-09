import * as vscode from 'vscode';
import * as fs from 'fs/promises';
const deepEqual = require('deep-equal');

import { v4 as uuid } from 'uuid';
import { CommandSettingEntry, EXTENSION, getConfiguration } from './config';
import { loadExternalCommands } from './externalCommands';
import * as path from 'path';
import { fileExists, mtime, removeUndefined, XOR } from './utils';


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
function toCommandPaletteItem(command: { command: string, when?: string }): CommandPaletteItem {
	return {
		command: customId(command.command),
		when: command.when ?? 'true',
	};
}
function toWorkspaceCommandPaletteItem(command: { command: string, when?: string }, workspaceId: string): CommandPaletteItem {
	return {
		command: customId(command.command),
		when: `${workspaceContextKey()} == ${workspaceId} && ` + (command.when ?? 'true'),
	};
}
function toCommandToRegisterFromAction(command: CommandToRegisterFromAction): CommandToRegisterFromAction {
	return {
		...command,
		command: customId(command.command),
	};
}
function toCommandToRegisterFromOriginal(command: CommandSettingEntry): CommandToRegisterFromOriginal {
	return {
		command: customId(command.command),
		originalCommand: command.command,
		args: command.args ?? [],
	};
}

async function getCommandsFromSettings(
	context: vscode.ExtensionContext,
	workspaceId: string,
): Promise<CommandsToUpdate & { commandsToRegister: CommandToRegisterFromOriginal[] }> {

	// global commands
	const customCommandsSetting = getConfiguration('commands') ?? [];
	const customCommandsFromSettings = customCommandsSetting.map(toCustomCommand);
	const commandPaletteItemsFromSettings = customCommandsSetting.map(toCommandPaletteItem);

	// workspace commands
	const customWorkspaceCommandsSetting = getConfiguration('workspaceCommands') ?? [];
	const customWorkspaceCommandsFromSettings = customWorkspaceCommandsSetting.map(toCustomCommand);
	const workspaceCommandPaletteItemsFromSettings = customWorkspaceCommandsSetting.map(
		(c: CommandSettingEntry) => toWorkspaceCommandPaletteItem(c, workspaceId));

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

	return {
		commands: customCommands,
		commandPaletteItems: commandPaletteItems,
		commandsToRegister: [...customCommandsSetting, ...customWorkspaceCommandsSetting].map(toCommandToRegisterFromOriginal),
	}
}


async function getFileCommands(
	context: vscode.ExtensionContext,
	options: XOR<{ workspaceId: string }, { global: true }>
) {
	// type-guard on options
	function _isGlobal(options: XOR<{ workspaceId: string }, { global: true }>): options is { global: true } {
		return options.global ?? false;
	}
	const isGlobal = _isGlobal(options);

	const scriptsTargetLocation = (__dirname + `/externals/${isGlobal ? 'global' : options.workspaceId}`);

	const commandFile = isGlobal ?
		context.globalState.get<string>('globalCommandsFile') :
		context.workspaceState.get<string>('commandsFile');
	const externalCommandsScriptPath = getConfiguration(isGlobal ? 'commandsFromFile' : 'workspaceCommandsFromFile');

	// handle file removed
	if (!externalCommandsScriptPath) {
		context.globalState.update('commandsFile', undefined);
		await fs.rmdir(scriptsTargetLocation, { recursive: true });
		return;
	}
	if (!await fileExists(externalCommandsScriptPath)) {
		return;
	}

	const fileName = path.parse(externalCommandsScriptPath).name;
	const scriptSavePath = path.join(scriptsTargetLocation, `${fileName}.mjs`)

	// check if file exists and is up to date
	const needToUpdate =
		(commandFile !== externalCommandsScriptPath) ||
		!await fileExists(scriptSavePath) ||
		await mtime(scriptSavePath) < await mtime(externalCommandsScriptPath);

	if (needToUpdate) {
		await fs.mkdir(scriptsTargetLocation, { recursive: true });
		await fs.copyFile(externalCommandsScriptPath, scriptSavePath);
		context.globalState.update('commandsFile', externalCommandsScriptPath);
	}
	const commands = await loadExternalCommands(scriptSavePath, externalCommandsScriptPath);

	return {
		commands: commands.commands.map(toCustomCommand).map(removeUndefined),
		commandPaletteItems: (isGlobal ?
			commands.commandPaletteItems.map(toCommandPaletteItem) :
			commands.commandPaletteItems.map((c: CommandPaletteItem) => toWorkspaceCommandPaletteItem(c, options.workspaceId))
		).map(removeUndefined),
		commandsToRegister: commands.commandsToRegister.map(toCommandToRegisterFromAction).map(removeUndefined),
	}
}
async function getWorkspaceFileCommands(
	context: vscode.ExtensionContext,
	workspaceId: string,
) {
	return getFileCommands(context, { workspaceId });
}

async function getGlobalFileCommands(
	context: vscode.ExtensionContext,
) {
	return getFileCommands(context, { global: true });
}

async function updateCommandsToPackageJson(toUpdate: CommandsToUpdate, packageJSON: any, packageJSONPath: string): Promise<void> {
	const anyChanges =
		!deepEqual(toUpdate.commands, packageJSON.contributes.commands) ||
		!deepEqual(toUpdate.commandPaletteItems, packageJSON.contributes.menus.commandPalette);

	if (anyChanges) {
		packageJSON.contributes.commands = toUpdate.commands;
		packageJSON.contributes.menus.commandPalette = toUpdate.commandPaletteItems;
		await fs.writeFile(packageJSONPath, JSON.stringify(packageJSON, undefined, 4).concat('\n'));
		const selection = await vscode.window.showInformationMessage('Command-palette (extension) have been updated. Please restart VS Code.', 'Restart VS Code');
		if (selection === 'Restart VS Code') {
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	}
}


function isCommandToRegisterFromAction(command: CommandToRegisterFromAction | CommandToRegisterFromOriginal): command is CommandToRegisterFromAction {
	return (command as CommandToRegisterFromAction).action !== undefined;
}

function registerCommand(command: CommandToRegisterFromAction | CommandToRegisterFromOriginal) {
	if (isCommandToRegisterFromAction(command)) {
		return vscode.commands.registerCommand(command.command, async () => {
			const more = { vscode, originalLocation: command.originalScriptLocation };
			await command.action(...command.args, more);
		})
	} else {
		return vscode.commands.registerCommand(command.command, async () => {
			await vscode.commands.executeCommand(command.originalCommand, ...command.args);
		})
	}
}

async function updateCommands(context: vscode.ExtensionContext, workspaceId: string, register: boolean) {

	const commands = await getCommandsFromSettings(context, workspaceId);
	if (register) context.subscriptions.push(...commands.commandsToRegister.map(registerCommand));

	// load global external commands
	const globalFileCommands = await getGlobalFileCommands(context);
	if (globalFileCommands) {
		if (register) context.subscriptions.push(...globalFileCommands.commandsToRegister.map(registerCommand));
	}
	// load workspace external commands
	const workspaceFileCommands = await getWorkspaceFileCommands(context, workspaceId);
	if (workspaceFileCommands) {
		if (register) context.subscriptions.push(...workspaceFileCommands.commandsToRegister.map(registerCommand));
	}

	// update in package.json
	await updateCommandsToPackageJson(
		{
			commands: [
				...commands.commands,
				...globalFileCommands?.commands ?? [],
				...workspaceFileCommands?.commands ?? []
			],
			commandPaletteItems: [
				...commands.commandPaletteItems,
				...globalFileCommands?.commandPaletteItems ?? [],
				...workspaceFileCommands?.commandPaletteItems ?? [],
			],
		},
		context.extension.packageJSON,
		context.extension.extensionPath + '/package.json'
	)
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
		vscode.workspace.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration(EXTENSION)) {
				const selection = await vscode.window.showInformationMessage(
					'Command-palette (extension) settings changed. Do you want to update? VSCode will need to be restarted', 'Update', 'Cancel');
				if (selection === 'Update') {
					await updateCommands(context, workspaceId, false);
				}
			}
		})
	);

	await updateCommands(context, workspaceId, true);
}

// this method is called when your extension is deactivated
export function deactivate() { }

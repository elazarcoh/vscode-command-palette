import { configUtils } from "vscode-extensions-json-generator/utils";	

export const EXTENSION = 'command-palette';

export interface CommandSettingEntry {

    /**
     * @description The command id.
     */
	command: string;

    /**
     * @description The title to display in the Command Palette.
     */
	title: string;

    /**
     * @description The category to display in the Command Palette.
     */
	category?: string;

    /**
     * @description A `when` expression to determine whether the command is available.
     */
	when?: string;

    /**
     * @description Arguments to pass to the command.
     */
	args?: any[];
}


export interface Config {
    /**
     * @scope machine 
     */
    commands: CommandSettingEntry[];
    /**
     * @scope window 
     */
    workspaceCommands: CommandSettingEntry[];
}

export const getConfiguration = configUtils.ConfigurationGetter<Config>(EXTENSION);
import * as path from "path";

export interface ExternalCommands {
    command: string;
    title: string;
    category?: string;
    when?: string;
    action: (...args: any[]) => any | Promise<any>;
    args?: any[];
}

export async function loadExternalCommands(
    filePath: string, originalFilePath: string
): Promise<CommandsToUpdate & { commandsToRegister: CommandToRegisterFromAction[] }> {

    const relative = "./" + path.relative(__dirname, filePath).replace(/\\/g, '/');

    const { default: commands }: { default: ExternalCommands[] } = await eval(`import('${relative}')`);
    return {
        commands: commands.map(c => ({
            command: c.command,
            title: c.title,
            category: c.category
        })),
        commandPaletteItems: commands.map(c => ({
            command: c.command,
            when: c.when ?? "true",
        })),
        commandsToRegister: commands.map(c => ({
            command: c.command,
            action: c.action,
            args: c.args ?? [],
            originalScriptLocation: originalFilePath,
        })),
    };
}

interface Command {
    command: string;
    title: string;
    category?: string;
}
interface CommandPaletteItem {
    command: string;
    when: string;
}
type CommandToRegisterFromOriginal = {
    command: string;
    originalCommand: string;
    args: any[];
}
type CommandToRegisterFromAction =  {
    command: string;
    action: (...args: any[]) => any | Promise<any>;
    originalScriptLocation: string;
    args: any[];
};
type CommandsToUpdate = {
    commands: Command[];
    commandPaletteItems: CommandPaletteItem[];
}

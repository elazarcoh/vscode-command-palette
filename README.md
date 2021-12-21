# command-palette VSCode extension

This extension give you the ability to add commands to the Command Palette.

There are two ways to add commands to the Command Palette:

1. Using an existing command, which is missing from the Command Palette. One example (for the time of writing) is the `editor.debug.action.selectionToRepl` command.
1. Creating a new command, by writing its code. This is a way to add commands that you need without have to create a dedicated VSCode extension.

It can be used, for example, with the [multi-command](https://marketplace.visualstudio.com/items?itemName=ryuta46.multi-command) extension.

## How to use with existing commands

-   `command`: The command to add to the Command Palette.
-   `title`: The title of the command.
-   `category`: The category of the command. Optional.
-   `when`: The condition to show the command. Optional.
-   `args`: The arguments for the command. Optional.

### Global commands

Add the following to your global ("User") settings:

```jsonc
{
    "multiCommand.commands": [
        {
            "command": "multiCommand.down3Lines",
            "sequence": ["cursorDown", "cursorDown", "cursorDown"]
        }
    ],
    "command-palette.commands": [
        {
            "command": "extension.multiCommand.execute",
            "title": "Down 3 lines",
            "args": [
                {
                    "command": "multiCommand.down3Lines"
                }
            ]
        }
    ]
}
```

When modifying the `command-palette.commands` setting, VSCode must be restarted for the changes to take effect.
A notification will be shown, asking to restart VSCode.

### Workspace commands

Use the `command-palette.workspaceCommands` in a workspace settings file to add commands to the Command Palette for a specific workspace.

### Some commands I found useful

```jsonc
{
    "command-palette.commands": [
        {
            "command": "editor.debug.action.selectionToRepl",
            "title": "Evaluate selection in Debug Console",
            "when": "inDebugMode"
        }
    ]
}
```

## How to create a new command

1. Create a JavaScript file.
1. Implement your command in the file as a function.
1. Add an exported array with the command (see example below).
1. Add the `command-palette.commandsFromFile` (global) or `command-palette.workspaceCommandsFromFile` (workspace) setting pointing to the file.

### Example

```javascript
// /path/to/external.ts
function externalCommandHelloWorld(msg, { vscode }) {
    vscode.window.showInformationMessage(`Hello from external.ts in ${msg}!`);
}

export default [
    {
        title: 'External: Hello World',
        command: 'external.helloWorld',
        action: externalCommandHelloWorld,
        args: [
            "${workspaceFolder}"
        ],
    },
];
```

Note that we got `vscode` as an argument. This allows us to use the `vscode` API in our commands.
Another argument passed to the commands is `originalLocation`, which is the location of the file.

```jsonc
// settings.json
{
    // ...
    "command-palette.commandsFromFile": "/path/to/external.js"
}
```
